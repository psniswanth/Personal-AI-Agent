# HARD RULES (read first)
- ALL browser automation goes through the `playwright-cli` binary (already installed globally). Never use `npx playwright`, `npm install playwright`, `@playwright/test`, `puppeteer`, `selenium`, or `require('playwright')`. Do not install any npm or pip package. Node scripts must call `playwright-cli` through `child_process` (execFile / spawn) only.
- Always use the named session: `playwright-cli -s=opencode ...`
- The shell is Windows PowerShell. Never use `which`, `ls -la`, `cat`, `grep`, `export`. Use Get-Command, Get-Content, `$env:NAME = "x"`.
- Never run `playwright-cli --help`. Use the cheat sheet below.
- Never run `playwright-cli close` unless the user asks. Keep the browser open between steps.
- Never read `.env`, never print credentials, never put credentials in a file that is not deleted afterwards.
- Do not guess locators. Run `find "<text>"` first and use the exact role and name it returns (VTOP menu items are `<a role="button">` with leading icon characters in the name, e.g. '  Academics').
- Exploration scripts use short timeouts ({ timeout: 5000 }). Never pass code inline to run-code, always use --filename.
- Never use `playwright-cli open` for VTOP. The browser is the dedicated Chrome below, reached with `attach`.

# Project facts
- Project: D:\Projects\PERSONAL AGENT\playwright-testing, Windows, Node installed.
- VTOP = https://vtop.vit.ac.in/vtop/ (single-page app: URL stays /vtop/content, top menu stays visible).
- VTOP login has a captcha. A captcha-autofill browser extension is installed in a dedicated Chrome profile. Never solve the captcha yourself.
- Chrome for VTOP is launched like this (debug port, extension profile):
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\Projects\PERSONAL AGENT\playwright-testing\.vtop-chrome" --start-maximized https://vtop.vit.ac.in/vtop/
- Attach the CLI to it: `playwright-cli -s=opencode attach --cdp=http://localhost:9222`
- Credentials: VTOP_USER and VTOP_PASS in `.env` (project root).

# playwright-cli cheat sheet (always with -s=opencode)
- `list`: show open or attached browsers
- `attach --cdp=http://localhost:9222`: attach to the running VTOP Chrome
- `tab-list`, `tab-select <n>`: manage tabs (the VTOP tab must be the selected one)
- `snapshot`: page state
- `find "<text>"`: search the page for text, returns elements with role and name
- `click "getByRole('link', { name: /Text/i })"`: click by Playwright locator
- `select "getByRole('combobox')" "<option text>"`, `fill "<locator>" "<text>"`, `press <key>`, `upload <file>`
- `eval "<js>"`: run JavaScript on the page (add `--raw` for the bare result)
- `--raw run-code --filename=actions/<name>.js`: run a saved action
- If a locator matches 2+ elements (strict mode error), use a more specific name or `.first()`.

# VTOP workflow
- Saved actions live in `actions/*.js`. Each is one `async page => { ... }` function that returns JSON. Run: `playwright-cli -s=opencode --raw run-code --filename=actions/<name>.js`
- Existing: check_attendance.js, check_marks.js. Each returns {"error":"not_logged_in"} if the Academics menu is not visible.
- For any VTOP question, first check `actions/` for a matching script and run it. Only explore with snapshots if no script exists or it fails, then write or fix the script.
- Before running an action, run `playwright-cli list`. If no browser is attached, run the attach command. If attach fails, tell the user to launch the VTOP Chrome (command above), then STOP.
- If an action returns {"error":"not_logged_in"}, tell the user to log in manually in that Chrome window and reply "logged in". Do not retry in a loop.

# Writing scripts from an exploration run
- Use only locators from the "Ran Playwright code" output or from `find`, never snapshot refs like e15.
- Include only the successful path: no dead ends, retries or sleeps. Use waitFor / waitForSelector on elements that exist only on the target page.
- Check `aria-expanded` before clicking a menu group so you do not collapse it.
- Put changing values (subject, assignment, file path) in constants at the top.
- Irreversible actions (final upload click) stay disabled unless a `CONFIRM = true` constant is set. Always ask the user before setting it.

# Answering
- For a specific course, match by title or code (case-insensitive, partial) in the action's JSON and report only that course. If both a theory (L) and a lab (P) entry exist, report both.
- Report attended/total and percentage. No extra commentary unless asked. When the task is done, report the result and stop.

# Login
- To log in to VTOP, run `node tools/create_vtop.js` and read its JSON ({"status":"logged_in"} / {"status":"already_logged_in"} / {"error":...}). It starts Chrome and attaches by itself.
- If a VTOP action returns {"error":"not_logged_in"}, run `node tools/create_vtop.js` once, then rerun the action. If login fails, tell the user. Do not loop.
