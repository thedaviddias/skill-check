Output docs/assets/skill-check-demo.gif

Set Theme "Catppuccin Mocha"
Set FontSize 18
Set Width 1000
Set Height 560
Set Shell "bash"

Type "echo \"skill-check demo: deterministic local run\""
Enter
Sleep 1s

Type "FORCE_COLOR=1 node dist/cli/main.js check fixtures/fail/multi-mixed --no-security-scan"
Enter
Sleep 8s
