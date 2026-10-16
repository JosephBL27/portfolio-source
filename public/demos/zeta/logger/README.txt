ZETAMAC TRIAL LOGGER — INSTALL

What it does
------------
This extension instruments the ORIGINAL arithmetic.zetamac.com page.
It does not answer questions, change ranges, or alter Zetamac's generator.

For every completed problem it records:
- exact question
- operation and operands
- total time until Zetamac advances
- time from question appearance to your first answer key
- remaining typing/completion time
- backspace/delete corrections
- derived family labels (×7, ÷8, subtraction borrow, magnitude bucket, etc.)
- a snapshot of visible Zetamac input/select settings at trial start
- observed operand ranges as a fallback when exact controls are unavailable

Install in Chrome
-----------------
1. Unzip zetamac_trial_logger.zip.
2. Open chrome://extensions
3. Turn on "Developer mode" in the upper-right.
4. Click "Load unpacked".
5. Select the unzipped "zetamac_trial_logger" folder.
6. Open/reload https://arithmetic.zetamac.com/

Using it
--------
1. Before the first scored trial, click "Reset / New Trial".
2. Play Zetamac normally.
3. When the trial ends, click "Copy for ChatGPT".
4. Paste the copied text into the ChatGPT conversation.
5. BEFORE the next trial, click "Reset / New Trial".

Alternative:
Click "Download JSON" and upload the .json file to ChatGPT.

Important
---------
The extension finalizes a question only when original Zetamac advances
to the next question, which occurs after a correct answer. An unfinished
question at the instant the timer expires is intentionally excluded.

The logger never calls eval(), never types into the answer field, and
never dispatches answer events.
