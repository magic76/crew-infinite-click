extends Node2D

var accent := Color("#7DD3FC")
var secondary := Color("#2563EB")
var pulses: Array = []
var echoes: Array = []
var cracks: Array = []

func set_palette(next_accent: Color, next_secondary: Color) -> void:
    accent = next_accent
    secondary = next_secondary
    queue_redraw()

func reset() -> void:
    pulses.clear()
    echoes.clear()
    cracks.clear()
    queue_redraw()

func add_tap(pos: Vector2, reaction: String, strength: float) -> void:
    var now := Time.get_ticks_msec() / 1000.0
    pulses.append({"pos": pos, "born": now, "life": 1.25, "reaction": reaction, "strength": strength})
    echoes.append({"pos": pos, "born": now, "life": 5.4, "strength": strength})
    if echoes.size() > 10:
        echoes.pop_front()
    if reaction == "CRACK" or reaction == "WARP":
        cracks.append({"pos": pos, "born": now, "life": 1.7, "seed": float(pos.x * 0.31 + pos.y * 0.73)})
    queue_redraw()

func _process(_delta: float) -> void:
    var now := Time.get_ticks_msec() / 1000.0
    pulses = pulses.filter(func(e): return now - float(e["born"]) < float(e["life"]))
    echoes = echoes.filter(func(e): return now - float(e["born"]) < float(e["life"]))
    cracks = cracks.filter(func(e): return now - float(e["born"]) < float(e["life"]))
    if not pulses.is_empty() or not echoes.is_empty() or not cracks.is_empty():
        queue_redraw()

func _draw() -> void:
    var now := Time.get_ticks_msec() / 1000.0

    for e in echoes:
        var age := (now - float(e["born"])) / float(e["life"])
        var alpha := (1.0 - age) * 0.12
        var radius := 26.0 + age * 420.0
        draw_arc(e["pos"], radius, 0.0, TAU, 96, Color(accent.r, accent.g, accent.b, alpha), 1.4, true)

    for e in pulses:
        var age := clamp((now - float(e["born"])) / float(e["life"]), 0.0, 1.0)
        var strength := float(e["strength"])
        var radius := 18.0 + age * (180.0 + 260.0 * strength)
        var alpha := pow(1.0 - age, 1.6)
        var reaction := String(e["reaction"])
        var width := 2.0 + 8.0 * (1.0 - age) * strength
        draw_arc(e["pos"], radius, 0.0, TAU, 112, Color(accent.r, accent.g, accent.b, alpha * 0.88), width, true)
        draw_arc(e["pos"], radius * 0.66, 0.0, TAU, 88, Color(secondary.r, secondary.g, secondary.b, alpha * 0.42), max(1.0, width * 0.4), true)
        if reaction == "MULTIPLY":
            for k in range(3):
                var off := Vector2(cos(float(k) * TAU / 3.0), sin(float(k) * TAU / 3.0)) * radius * 0.42
                draw_circle(e["pos"] + off, max(2.0, 8.0 * (1.0 - age)), Color(accent.r, accent.g, accent.b, alpha * 0.75))

    for e in cracks:
        var age := clamp((now - float(e["born"])) / float(e["life"]), 0.0, 1.0)
        var alpha := pow(1.0 - age, 1.35)
        var origin: Vector2 = e["pos"]
        var seed := float(e["seed"])
        for branch in range(8):
            var angle := float(branch) * TAU / 8.0 + sin(seed * 11.0 + float(branch)) * 0.22
            var point := origin
            for segment in range(5):
                var length := 25.0 + float(segment) * 18.0 + age * 26.0
                angle += sin(seed * 37.0 + float(branch * 9 + segment)) * 0.18
                var next := point + Vector2(cos(angle), sin(angle)) * length
                draw_line(point, next, Color(accent.r, accent.g, accent.b, alpha * (0.70 - float(segment) * 0.09)), max(1.0, 3.0 * (1.0 - age)), true)
                point = next
