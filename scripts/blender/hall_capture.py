"""Photographic hall delivery. Source: Poly Haven Old Hall (Sergej Majboroda, CC0).
Uses the existing Blender process through MCP; never edits the incumbent scene.
Run: exec(compile(open(P).read(), P, 'exec'), {'__name__':'hall_capture'})
Source HDR is outside the repository. Public output contains only display WebP.
"""
import bpy, math, json, os, time
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
# the shared Poly Haven cache first (md5-checked against the API, `polyhaven_fetch.py adopt hdri old_hall 8k <file>`, 2026-10-12), then the private copy it was adopted from
SOURCE=next((p for p in (os.path.expanduser('~/AgentRuntime/assets/polyhaven/old_hall/old_hall_8k.hdr'), os.path.expanduser('~/.cache/portfolio-hall/old-hall/old_hall_8k.hdr')) if os.path.exists(p)), os.path.expanduser('~/AgentRuntime/assets/polyhaven/old_hall/old_hall_8k.hdr'))
OUT=ROOT+'/out/hall-rebuild'
os.makedirs(OUT,exist_ok=True)
sc=bpy.data.scenes.new('portfolio_hall_capture_'+str(int(time.time())))
sc.render.engine='CYCLES'
sc.cycles.device='GPU'
sc.cycles.samples=128
sc.cycles.use_adaptive_sampling=True
sc.cycles.adaptive_threshold=0.02
sc.cycles.adaptive_min_samples=16
sc.cycles.use_denoising=True
sc.cycles.denoiser='OPENIMAGEDENOISE'
sc.cycles.max_bounces=6
sc.cycles.diffuse_bounces=3
sc.cycles.glossy_bounces=3
sc.cycles.transmission_bounces=3
sc.cycles.transparent_max_bounces=8
sc.cycles.volume_bounces=2
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='METAL'
prefs.get_devices()
for d in prefs.devices: d.use=d.type=='METAL'
if not any(d.type=='METAL' and d.use for d in prefs.devices):
    raise RuntimeError('Metal GPU required; refusing silent CPU fallback')
sc.view_settings.view_transform='AgX'
sc.view_settings.look='AgX - Medium High Contrast'
sc.view_settings.exposure=-1.0
sc.render.resolution_x=8192
sc.render.resolution_y=4096
sc.render.resolution_percentage=100
sc.render.image_settings.file_format='PNG'
sc.render.image_settings.color_mode='RGB'
sc.render.image_settings.color_depth='8'
sc.render.film_transparent=False
world=bpy.data.worlds.new(sc.name+'_world');sc.world=world;world.use_nodes=True
nt=world.node_tree; nt.nodes.clear()
tex=nt.nodes.new('ShaderNodeTexEnvironment');tex.image=bpy.data.images.load(SOURCE,check_existing=True)
bg=nt.nodes.new('ShaderNodeBackground');bg.inputs['Strength'].default_value=1.0
output=nt.nodes.new('ShaderNodeOutputWorld');nt.links.new(tex.outputs['Color'],bg.inputs['Color']);nt.links.new(bg.outputs[0],output.inputs[0])
camdata=bpy.data.cameras.new(sc.name+'_camera');camdata.type='PANO';camdata.panorama_type='EQUIRECTANGULAR'
cam=bpy.data.objects.new(camdata.name,camdata);sc.collection.objects.link(cam);cam.rotation_euler=(math.pi/2,0,0);sc.camera=cam
sc.render.filepath=OUT+'/hall-capture-8k.png'
if bpy.app.background:
    bpy.context.window.scene=sc
    bpy.ops.wm.save_as_mainfile(filepath=OUT+'/Photographic_Hall.blend')
meta={'blender':bpy.app.version_string,'backend':prefs.compute_device_type,'devices':[(d.name,d.type,d.use) for d in prefs.devices],'engine':sc.render.engine,'device':sc.cycles.device,'samples':sc.cycles.samples,'adaptive_threshold':sc.cycles.adaptive_threshold,'denoiser':sc.cycles.denoiser,'view_transform':sc.view_settings.view_transform,'look':sc.view_settings.look,'exposure':sc.view_settings.exposure,'resolution':[8192,4096],'source':'https://polyhaven.com/a/old_hall','author':'Sergej Majboroda','licence':'CC0','source_md5':'38f1ff41988c5bd94c6c6e919457f00e','status':'queued'}
json.dump(meta,open(OUT+'/render.json','w'),indent=2)
def render():
    t=time.time();meta['status']='rendering';json.dump(meta,open(OUT+'/render.json','w'),indent=2)
    try:
        bpy.ops.render.render(write_still=True,scene=sc.name)
        meta['status']='complete';meta['seconds']=time.time()-t
    except Exception as e:
        meta['status']='failed';meta['error']=repr(e)
    json.dump(meta,open(OUT+'/render.json','w'),indent=2)
    return None
if bpy.app.background:
    render()
else:
    bpy.app.timers.register(render,first_interval=1.0)
print(meta)
