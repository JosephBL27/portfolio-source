# Shared helpers for the unit-14D model scripts (hub_tv.py, turntable.py, chess.py). Run through Blender 5.2 headless, one process at a time:
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/turntable.py -- public/models/glb/turntable.glb
# Everything is authored in SITE coordinates (x right, y up, z toward the viewer) through S(); the glTF exporter turns Blender's Z-up back into Y-up.
# A model is a handful of named parts (one mesh each). A part is built in a bmesh with the add_* helpers, finished with part(), AO-baked into a float
# vertex colour (grey: a straight ambient-occlusion factor, the site multiplies it into the indirect light, see src/v3/world/glbmodel.ts) and
# exported as a GLB with Draco compression (decoder: public/draco, loaded lazily). No materials and no textures are exported: the site assigns its own PBR materials by part name.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

TAU = math.tau


def S(x, y, z):
    """site (x, y, z) -> Blender (X, Y, Z)"""
    return Vector((x, -z, y))


def setup(samples=64):
    """empty scene for an AO bake. Cycles on the M5's Metal GPU (works headless on Blender 5.2.2: 6/6 runs 2026-10-11, 7/7 more in r5; the old "Metal HANGS"
    note did not reproduce, the likely cause was first-use kernel compilation). No silent fallback: M5_DEVICE=cpu forces the CPU, a missing Metal device raises.
    read_factory_settings below drops the saved Metal prefs, which is why the device is set here, through m5_preset, every time."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sys.dont_write_bytecode = True
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import m5_preset
    sc = bpy.context.scene
    m5_preset.apply_bake(sc, samples)
    return sc


# ------------------------------------------------------------------------------------------------ primitives (into a bmesh, site coordinates)
def _tfm_site(bm, verts, size, c):
    for v in verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[2], v.co.z * size[1])) + S(*c)


def add_box(bm, c, size, bevel=0.0, seg=3, bevel_edges=None, warp=None):
    """a box centred at c (site), size = (sx, sy, sz). bevel: radius of the rounded edges. warp(v): moves a corner vertex (a taper) before the bevel"""
    r = bmesh.ops.create_cube(bm, size=1.0)
    verts = r['verts']
    _tfm_site(bm, verts, size, c)
    if warp:
        for v in verts:
            warp(v)
    if bevel > 0:
        edges = list({e for v in verts for e in v.link_edges})
        if bevel_edges:
            edges = [e for e in edges if bevel_edges(e)]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=seg, profile=0.5, affect='EDGES')
    return verts


def add_lathe(bm, prof, c=(0, 0, 0), axis='y', segs=64, closed=False, uv=False, rot=0.0, scale=(1, 1)):
    """revolve prof [(r, h), ...] about an axis through c. axis 'y' = up, 'x' = along x, 'z' = toward the viewer. h runs along the axis.
    A point with r ~ 0 collapses to a single pole vertex. closed=True joins the last point back to the first (a ring / tube section)."""
    n = len(prof)
    rings = []
    for i, (r, h) in enumerate(prof):
        if r < 1e-6:
            if axis == 'y':
                p = (0, h, 0)
            elif axis == 'x':
                p = (h, 0, 0)
            else:
                p = (0, 0, h)
            rings.append([bm.verts.new(S(c[0] + p[0], c[1] + p[1], c[2] + p[2]))])
        else:
            row = []
            for j in range(segs):
                a = TAU * j / segs + rot
                ca, sa = math.cos(a) * r * scale[0], math.sin(a) * r * scale[1]
                if axis == 'y':
                    p = (ca, h, sa)
                elif axis == 'x':
                    p = (h, ca, sa)
                else:
                    p = (ca, sa, h)
                row.append(bm.verts.new(S(c[0] + p[0], c[1] + p[1], c[2] + p[2])))
            rings.append(row)
    faces = []
    pairs = [(i, i + 1) for i in range(n - 1)] + ([(n - 1, 0)] if closed else [])
    for i, k in pairs:
        A, B = rings[i], rings[k]
        for j in range(segs):
            j2 = (j + 1) % segs
            try:
                if len(A) == 1 and len(B) == 1:
                    continue
                if len(A) == 1:
                    f = bm.faces.new((A[0], B[j2], B[j]))
                elif len(B) == 1:
                    f = bm.faces.new((A[j], A[j2], B[0]))
                else:
                    f = bm.faces.new((A[j], A[j2], B[j2], B[j]))
                faces.append(f)
            except ValueError:
                pass
    if uv:
        # u runs round the circumference, v along the profile length (the strobe band and anything that wants a wrapped map)
        layer = bm.loops.layers.uv.verify()
        idx = {}
        for i, row in enumerate(rings):
            for j, v in enumerate(row):
                idx[v.index] = (i, j)
        tot = max(1e-6, sum(math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]) for i in range(n - 1)))
        acc = [0.0]
        for i in range(n - 1):
            acc.append(acc[-1] + math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]))
        for f in faces:
            for l in f.loops:
                i, j = idx.get(l.vert.index, (0, 0))
                jj = j
                # seam: the last column wraps to u = 1 on faces that straddle it
                if len(f.loops) == 4 and j == 0 and any(idx.get(q.vert.index, (0, 0))[1] == segs - 1 for q in f.loops):
                    jj = segs
                l[layer].uv = (jj / segs, acc[i] / tot)
    if not closed or True:
        bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def add_torus(bm, c, R, r, axis='y', segs=48, rsegs=10, scale=(1, 1)):
    prof = [(R + r * math.cos(TAU * k / rsegs), r * math.sin(TAU * k / rsegs)) for k in range(rsegs)]
    return add_lathe(bm, prof, c, axis=axis, segs=segs, closed=True, scale=scale)


def add_cyl(bm, c, r, h, axis='y', segs=48, bevel=0.0, bseg=3):
    """a capped cylinder (centred at c, length h along the axis); bevel rounds both rims through the profile"""
    hh = h / 2
    b = min(bevel, r * 0.95, hh * 0.95)
    if b > 0:
        arc = lambda cx, cz, a0, a1: [(cx + b * math.cos(a0 + (a1 - a0) * k / bseg), cz + b * math.sin(a0 + (a1 - a0) * k / bseg)) for k in range(bseg + 1)]
        prof = [(0, -hh)] + arc(r - b, -hh + b, -math.pi / 2, 0) + arc(r - b, hh - b, 0, math.pi / 2) + [(0, hh)]
        prof = [(max(0.0, a), z) for a, z in prof]
    else:
        prof = [(0, -hh), (r, -hh), (r, hh), (0, hh)]
    return add_lathe(bm, prof, c, axis=axis, segs=segs)


def add_screw(bm, c, r, h, axis='y', segs=18, slot=True):
    """a pan-head screw standing on the surface at c (site; the foot of the head). Cross-slotted: the slots are modelled as a dip in the crown."""
    prof = [(0, 0), (r, 0), (r * 1.0, h * 0.35), (r * 0.9, h * 0.8), (r * 0.62, h), (r * 0.2, h * 0.86), (0, h * 0.6)]
    add_lathe(bm, prof, c, axis=axis, segs=segs)


def site_of(co):
    """Blender coordinate -> site (x, y, z)"""
    return (co.x, co.z, -co.y)


def subdivide_long(bm, maxlen, rounds=8, coarse=None, near=None):
    """cut every edge longer than maxlen (mesh triangulated first so the grid fill is always valid): vertex AO needs vertices where the shade changes.
    With near(site_point) -> bool, only edges whose middle is near a feature get the fine maxlen; the rest are cut only to `coarse` (the vertex budget)."""
    for _ in range(rounds):
        if near is None:
            edges = [e for e in bm.edges if e.calc_length() > maxlen]
        else:
            edges = [e for e in bm.edges if e.calc_length() > (maxlen if near(site_of((e.verts[0].co + e.verts[1].co) * 0.5)) else coarse)]
        if not edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])


def sharpen(bm, angle=0.62):
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > angle:
            e.smooth = False
        else:
            e.smooth = True
    for f in bm.faces:
        f.smooth = True


def planar_uv(bm, scale, axes_for_normal=None):
    """box-projected UVs for slab-like parts: the dominant face axis picks the plane. scale = (su, sv) units per uv unit (site units)"""
    layer = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda k: abs(n[k]))
        for l in f.loops:
            p = l.vert.co          # Blender coords: X = site x, Y = -site z, Z = site y
            sx, sy, sz = p.x, p.z, -p.y
            if ax == 2:      # +-Z (blender) = site y: top / bottom -> (x, z)
                u, v = sx, sz
            elif ax == 0:    # site x faces -> (z, y)
                u, v = sz, sy
            else:            # site z faces -> (x, y)
                u, v = sx, sy
            l[layer].uv = (u / scale[0] + 0.5, v / scale[1] + 0.5)


# ------------------------------------------------------------------------------------------------ parts
def part(name, bm, loc=None, dense=0.0, smooth_angle=0.62, uv=None, local=False, coarse=None, near=None):
    """finish a bmesh into an object named `name`. loc (site) puts the object origin there: the bmesh is shifted back so it stays where it was built, unless local=True (it was already built around the origin)."""
    if dense > 0:
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        subdivide_long(bm, dense, coarse=coarse, near=near)
    sharpen(bm, smooth_angle)
    if uv:
        planar_uv(bm, uv)
    me = bpy.data.meshes.new(name)
    if loc is not None and not local:
        bmesh.ops.translate(bm, vec=-S(*loc), verts=list(bm.verts))
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if loc is not None:
        ob.location = S(*loc)
    me.update()
    return ob


def boolean(ob, cutter_bm_fn, op='DIFFERENCE'):
    """subtract a cutter (built by cutter_bm_fn(bm), site coordinates) from ob (exact solver)"""
    bm = bmesh.new()
    cutter_bm_fn(bm)
    me = bpy.data.meshes.new(ob.name + '_cut')
    bm.to_mesh(me)
    bm.free()
    cut = bpy.data.objects.new(ob.name + '_cut', me)
    bpy.context.scene.collection.objects.link(cut)
    if ob.location.length > 0:
        cut.location = Vector((0, 0, 0))
    md = ob.modifiers.new('bool', 'BOOLEAN')
    md.operation = op
    md.object = cut
    md.solver = 'EXACT'
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier='bool')
    bpy.data.objects.remove(cut)
    bpy.data.meshes.remove(me)


def redo_dense(ob, dense, smooth_angle=0.62, uv=None, coarse=None, near=None):
    """re-open an object's mesh (after a boolean): triangulate, densify for AO, re-sharpen"""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    if dense > 0:
        subdivide_long(bm, dense, coarse=coarse, near=near)
    sharpen(bm, smooth_angle)
    if uv:
        planar_uv(bm, uv)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


# ------------------------------------------------------------------------------------------------ AO bake + export
def orient_out(bm, faces, c, axis='y', inward=False):
    """flip the faces of an OPEN lathe surface (a tube, a shell) so the normals point away from (or, inward=True, toward) the axis through c (site)"""
    bad = []
    for f in faces:
        if not f.is_valid:
            continue
        ctr = Vector(site_of(f.calc_center_median())) - Vector(c)
        n = Vector(site_of(f.normal))
        k = {'x': 0, 'y': 1, 'z': 2}[axis]
        ctr[k] = 0.0
        if (n.dot(ctr) < 0) != inward:
            bad.append(f)
    if bad:
        bmesh.ops.reverse_faces(bm, faces=bad)


def place_local(bm, first, origin, fx, fy, fz):
    """move the vertices bm.verts[first:] from a local frame (site axes: x, y, z built about the origin) onto a frame whose axes are the site vectors fx, fy, fz at `origin`"""
    O, X, Y, Z = Vector(origin), Vector(fx), Vector(fy), Vector(fz)
    for v in list(bm.verts)[first:]:
        lx, ly, lz = site_of(v.co)
        w = O + X * lx + Y * ly + Z * lz
        v.co = S(w.x, w.y, w.z)


def frame_at(d):
    """the same frame tv.ts frameAt() builds for a direction on the sphere: z = d, y = up projected into the tangent plane, x = y cross z"""
    z = Vector(d).normalized()
    y = (Vector((0, 1, 0)) - z * z.y).normalized()
    x = y.cross(z)
    return x, y, z


def bake_ao(objs, dist=0.5, gamma=1.0, floor=0.0, hide=(), smooth=2):
    """bake ambient occlusion into a float vertex colour on each object of objs, against everything visible in the scene.
    `occluders`: extra objects that count for occlusion but are not baked or exported (they are hidden from the export by the caller).
    result r = g = b = floor + (1 - floor) * ao ** gamma"""
    sc = bpy.context.scene
    sc.world = bpy.data.worlds.new('w')
    sc.world.use_nodes = True
    sc.world.light_settings.distance = dist   # the AO bake's ray length; Blender 5.2 has no light_settings.use_ambient_occlusion (only ao_factor and distance), the old line threw and was swallowed
    mat = bpy.data.materials.new('aomat')
    mat.use_nodes = True
    for h in hide:
        h.hide_render = True
    for ob in objs:
        me = ob.data
        for a in list(me.color_attributes):
            me.color_attributes.remove(a)
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        me.color_attributes.active_color = ca
        me.color_attributes.render_color_index = 0
        if not me.materials:
            me.materials.append(mat)
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        try:
            bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        except Exception as e:
            print('AO BAKE FAILED', ob.name, e)
        n = len(me.vertices)
        buf = [0.0] * (n * 4)
        ca.data.foreach_get('color', buf)
        out = [0.0] * (n * 4)
        ao = [max(0.0, min(1.0, buf[i * 4])) for i in range(n)]
        # the bake is noisy at a few dozen samples per vertex: relax each vertex toward the mean of its neighbours (mesh edges), a couple of passes
        nb = [[] for _ in range(n)]
        for e in me.edges:
            a, b = e.vertices
            nb[a].append(b)
            nb[b].append(a)
        for _ in range(smooth):
            ao = [0.5 * ao[i] + 0.5 * (sum(ao[j] for j in nb[i]) / len(nb[i])) if nb[i] else ao[i] for i in range(n)]
        for i in range(n):
            a = ao[i]
            a = floor + (1.0 - floor) * (a ** gamma)
            out[i * 4:i * 4 + 4] = [a, a, a, 1.0]
        ca.data.foreach_set('color', out)
        me.update()
        print('AO', ob.name, n, 'verts')
    for h in hide:
        h.hide_render = False


def export(path, objs, uv=False):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
              export_materials='NONE', export_image_format='NONE', export_texcoords=uv, export_normals=True, export_cameras=False, export_lights=False,
              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6, export_draco_position_quantization=14,
              export_draco_normal_quantization=10, export_draco_texcoord_quantization=12, export_draco_color_quantization=8, export_draco_generic_quantization=12)
    try:
        bpy.ops.export_scene.gltf(export_vertex_color='ACTIVE', **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(export_active_vertex_color_when_no_material=True, **kw)
    import os
    print('EXPORT_OK', path, os.path.getsize(path), 'bytes')


def argv_out(default):
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return a[0] if a else default


def rr_ring(hx, hz, rc, nx, nz, na, cz=0.0):
    """points (x, z) round a rounded rectangle of half sizes hx, hz (corner radius rc), counter-clockwise from above, nx / nz points per straight side, na per corner"""
    rc = max(0.004, min(rc, hx - 0.001, hz - 0.001))
    pts = []
    corners = [(hx - rc, hz - rc, 0.0), (-(hx - rc), hz - rc, math.pi / 2), (-(hx - rc), -(hz - rc), math.pi), (hx - rc, -(hz - rc), 3 * math.pi / 2)]
    for ci, (cx, czz, a0) in enumerate(corners):
        for k in range(na + 1):
            a = a0 + (math.pi / 2) * k / na
            pts.append((cx + rc * math.cos(a), czz + rc * math.sin(a) + cz))
        # straight run to the next corner
        nxt = corners[(ci + 1) % 4]
        a1 = a0 + math.pi / 2
        p0 = (cx + rc * math.cos(a1), czz + rc * math.sin(a1) + cz)
        p1 = (nxt[0] + rc * math.cos(a1), nxt[1] + rc * math.sin(a1) + cz)
        n = nx if ci % 2 == 1 else nz
        for k in range(1, n):
            t = k / n
            pts.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t))
    return pts


def add_rect_sweep(bm, prof, W, D, cz=0.0, rc=0.05, step=0.12, na=6, uv_u=None):
    """sweep a profile [(inset, y), ...] (inset: distance in from the rectangle W x D centred at (0, cz); negative = proud) round the rounded rectangle:
    walnut mouldings, brass beads, the plinth. An open surface, normals out. uv_u = world length per u unit (u runs round the perimeter, v up the profile)."""
    nx, nz = max(2, int(W / step)), max(2, int(D / step))
    rings = []
    for (off, y) in prof:
        pts = rr_ring(W / 2 - off, D / 2 - off, rc - off if rc - off > 0.004 else 0.004, nx, nz, na, cz)
        rings.append([bm.verts.new(S(x, y, z)) for (x, z) in pts])
    faces = []
    n = len(rings[0])
    for i in range(len(prof) - 1):
        A, B = rings[i], rings[i + 1]
        for j in range(n):
            j2 = (j + 1) % n
            try:
                faces.append(bm.faces.new((A[j], A[j2], B[j2], B[j])))
            except ValueError:
                pass
    # orientation: judge by the face with the most horizontal normal
    best, bd = None, -1.0
    for f in faces:
        nrm = Vector(site_of(f.normal))
        h = math.hypot(nrm.x, nrm.z)
        if h > bd:
            bd, best = h, f
    if best is not None:
        nrm = Vector(site_of(best.normal))
        ctr = Vector(site_of(best.calc_center_median())) - Vector((0, 0, cz))
        if nrm.x * ctr.x + nrm.z * ctr.z < 0:
            bmesh.ops.reverse_faces(bm, faces=faces)
    if uv_u:
        layer = bm.loops.layers.uv.verify()
        ys = [p[1] for p in prof]
        y0, y1 = min(ys), max(ys)
        idx = {}
        for i, row in enumerate(rings):
            for j, v in enumerate(row):
                idx[v.index] = (i, j)
        # cumulative perimeter length along ring 0
        P = [Vector(v.co) for v in rings[0]]
        cum = [0.0]
        for j in range(1, n + 1):
            cum.append(cum[-1] + (P[j % n] - P[j - 1]).length)
        for f in faces:
            if not f.is_valid:
                continue
            for l in f.loops:
                i, j = idx[l.vert.index]
                jj = j
                if any(idx[q.vert.index][1] == n - 1 for q in f.loops) and j == 0:
                    jj = n
                l[layer].uv = (cum[jj] / uv_u, (prof[i][1] - y0) / (y1 - y0 + 1e-9))
    return faces
