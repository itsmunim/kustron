# kustron demo — zero to fullstack environment
Output /tmp/opencode/fullstack-draft.mp4
Set Shell zsh
Set FontSize 14
Set Width 1600
Set Height 900
Set Padding 28
Set Theme {"background": "#0b0e14", "foreground": "#e6edf3", "cursor": "#4ec9b0"}
Set PlaybackSpeed 1.4

# ── intro ──
Type "./title.sh 0" Enter
Sleep 2
Ctrl+L
Type "cd demo/fullstack" Enter
Sleep 2
Type "kustron doctor" Enter
Sleep 5
Type "cat kustron-env.yaml" Enter
Sleep 4

# ── part 1: CRUD app on kivo ──
Type "./title.sh 1" Enter
Sleep 2
Ctrl+L
Type "kustron env up" Enter
Sleep 72
Type "curl -s -X POST localhost:30000/items -H 'Content-Type: application/json' -d '{\"id\":\"sku-1001\",\"product\":\"anvil\",\"price\":\"42.00\"}'" Enter
Sleep 3
Type "curl -s localhost:30000/items" Enter
Sleep 3

# ── part 2: live rebuild via env watch (split terminal) ──
Type "./title.sh 2" Enter
Sleep 2
Ctrl+L
Ctrl+b %
Sleep 1
Type "kustron env watch" Enter
Sleep 4
Ctrl+b o
Type "curl -s -o /dev/null -w '%{http_code}' localhost:30000/orders" Enter
Sleep 3
Ctrl+b o
Type "./add-orders.sh" Enter
Sleep 36
Type "curl -s localhost:30000/orders" Enter
Sleep 3

# ── part 3: rabbitmq chart + order stream ──
Type "./title.sh 3" Enter
Sleep 2
Ctrl+b o
Type "./add-rabbit.sh" Enter
Sleep 128
Type "curl -s -X POST localhost:30000/orders -H 'Content-Type: application/json' -d '{\"product\":\"anvil\",\"qty\":2}'" Enter
Sleep 3
Type "kustron app logs webapi" Enter
Sleep 4
Type "curl -s localhost:30000/orders" Enter
Sleep 3

# ── part 4: deploy straight from GitHub ──
Type "./title.sh 4" Enter
Sleep 2
Ctrl+b o
Type "./add-hello.sh" Enter
Sleep 46
Type "curl -sL localhost:30001/v1/hello" Enter
Sleep 3

# ── outro ──
Type "./title.sh 5" Enter
Sleep 2
Ctrl+b o
Type "kustron env destroy --yes" Enter
Sleep 8
Type "exit" Enter
