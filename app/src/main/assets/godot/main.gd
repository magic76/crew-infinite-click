extends Node2D

const BRIDGE_NAME := "InfiniteClickBridge"
const LAYOUTS := {"FIELD": 0, "TUNNEL": 1, "VORTEX": 2, "GATE": 3, "SHARD_STORM": 4}
const ENVIRONMENTS := {"FOG": 0, "STARDUST": 1, "SMOKE": 2, "BUBBLES": 3, "ASH": 4, "POLLEN": 5, "GLITCH": 6}
const MATERIALS := {"GLASS": 0, "METAL": 1, "BIO": 2, "ENERGY": 3, "CRYSTAL": 4, "INK": 5}
const COMPOSITIONS := {"CENTER": 0, "EDGE": 1, "DIAGONAL": 2, "SPIRAL": 3, "CLUSTERED": 4, "HOLLOW_CENTER": 5}

var bridge = null
var background: ColorRect
var background_material: ShaderMaterial
var overlay: Node2D
var burst_particles: GPUParticles2D
var gravity_particles: GPUParticles2D
var portal_particles: GPUParticles2D
var glow_texture: Texture2D

var current_plan := {
    "theme": "COSMIC",
    "motif": "ORBS",
    "mood": "CURIOUS",
    "tapReaction": "BLOOM",
    "evolution": "DRIFT",
    "layout": "FIELD",
    "cameraMotion": "DRIFT",
    "composition": "CLUSTERED",
    "environment": "STARDUST",
    "materialStyle": "ENERGY",
    "density": 0.48,
    "motion": 0.42,
    "scale": 0.62,
    "depth": 0.62,
    "particleLevel": 0.55,
    "pulseStrength": 0.62,
    "contrastLevel": 0.68,
    "palette": {"primary": "#070B1A", "secondary": "#172554", "accent": "#7DD3FC"}
}

var shock_progress := 1.0
var shock_strength := 0.0
var portal_strength := 0.0
var gravity_strength := 0.0
var flash_strength := 0.0
var last_tap := Vector2(0.5, 0.5)
var last_seq := 0
var gravity_stop_at := 0.0
var portal_stop_at := 0.0

func _ready() -> void:
    _build_background()
    glow_texture = _make_glow_texture(48)
    _build_particles()
    _build_overlay()
    _resize_world()
    get_viewport().size_changed.connect(_resize_world)
    _apply_world_plan(current_plan)
    _connect_bridge()
    _report_scene_ready()

func _process(delta: float) -> void:
    if bridge == null:
        _connect_bridge()
        _report_scene_ready()

    if shock_progress < 1.0:
        shock_progress = min(1.0, shock_progress + delta * (0.78 + float(current_plan.get("motion", 0.4)) * 1.05))
        shock_strength = max(0.0, shock_strength - delta * 0.42)
    else:
        shock_strength = max(0.0, shock_strength - delta * 1.8)

    portal_strength = max(0.0, portal_strength - delta * 0.18)
    gravity_strength = max(0.0, gravity_strength - delta * 0.30)
    flash_strength = max(0.0, flash_strength - delta * 2.8)

    var now := Time.get_ticks_msec() / 1000.0
    if gravity_stop_at > 0.0 and now >= gravity_stop_at:
        gravity_particles.emitting = false
        gravity_stop_at = 0.0
    if portal_stop_at > 0.0 and now >= portal_stop_at:
        portal_particles.emitting = false
        portal_stop_at = 0.0

    _sync_dynamic_uniforms()

func _connect_bridge() -> void:
    if bridge != null or not Engine.has_singleton(BRIDGE_NAME):
        return
    bridge = Engine.get_singleton(BRIDGE_NAME)
    var callback := Callable(self, "_on_visual_command")
    if bridge.has_signal("visual_command") and not bridge.is_connected("visual_command", callback):
        bridge.connect("visual_command", callback)

func _report_scene_ready() -> void:
    if bridge == null:
        return
    if bridge.has_method("reportSceneReady"):
        bridge.reportSceneReady()

func _on_visual_command(raw: String) -> void:
    var data = JSON.parse_string(raw)
    if typeof(data) != TYPE_DICTIONARY:
        return
    var seq := int(data.get("seq", 0))
    if seq > 0 and seq <= last_seq:
        return
    if seq > 0:
        last_seq = seq

    var kind := String(data.get("type", ""))
    if kind == "world_plan":
        var plan = data.get("plan", {})
        if typeof(plan) == TYPE_DICTIONARY:
            _apply_world_plan(plan)
    elif kind == "tap":
        _handle_tap(data)
    elif kind == "effect":
        _handle_effect(data)
    elif kind == "reset":
        _reset_vfx()

func _build_background() -> void:
    background = ColorRect.new()
    background.name = "ProceduralNebula"
    background.mouse_filter = Control.MOUSE_FILTER_IGNORE
    background.color = Color("#071022") # Visible fallback even if shader compilation fails.
    background.z_index = -100
    add_child(background)

    background_material = ShaderMaterial.new()
    background_material.shader = load("res://godot/nebula.gdshader")
    background.material = background_material

func _build_overlay() -> void:
    overlay = Node2D.new()
    overlay.name = "TapEchoOverlay"
    overlay.z_index = 20
    overlay.set_script(load("res://godot/effects_overlay.gd"))
    add_child(overlay)

func _build_particles() -> void:
    burst_particles = _make_burst_particles()
    burst_particles.name = "BurstParticles"
    burst_particles.z_index = 30
    add_child(burst_particles)

    gravity_particles = _make_gravity_particles()
    gravity_particles.name = "GravityParticles"
    gravity_particles.z_index = 18
    add_child(gravity_particles)

    portal_particles = _make_portal_particles()
    portal_particles.name = "PortalParticles"
    portal_particles.z_index = 16
    add_child(portal_particles)

func _make_burst_particles() -> GPUParticles2D:
    var p := GPUParticles2D.new()
    p.amount = 220
    p.lifetime = 1.05
    p.one_shot = true
    p.explosiveness = 0.96
    p.randomness = 0.34
    p.emitting = false
    p.texture = glow_texture
    p.visibility_rect = Rect2(-1600, -2800, 3200, 5600)
    p.material = _make_additive_canvas_material()

    var m := ParticleProcessMaterial.new()
    m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
    m.emission_sphere_radius = 5.0
    m.direction = Vector3(1.0, 0.0, 0.0)
    m.spread = 180.0
    m.gravity = Vector3(0.0, 45.0, 0.0)
    m.initial_velocity_min = 180.0
    m.initial_velocity_max = 680.0
    m.damping_min = 20.0
    m.damping_max = 70.0
    m.scale_min = 0.10
    m.scale_max = 0.62
    m.color_ramp = _make_life_ramp()
    p.process_material = m
    return p

func _make_gravity_particles() -> GPUParticles2D:
    var p := GPUParticles2D.new()
    p.amount = 190
    p.lifetime = 1.8
    p.one_shot = false
    p.explosiveness = 0.58
    p.randomness = 0.30
    p.emitting = false
    p.texture = glow_texture
    p.visibility_rect = Rect2(-1600, -2800, 3200, 5600)
    p.material = _make_additive_canvas_material()

    var m := ParticleProcessMaterial.new()
    m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
    m.emission_sphere_radius = 300.0
    m.direction = Vector3(1.0, 0.0, 0.0)
    m.spread = 180.0
    m.gravity = Vector3.ZERO
    m.initial_velocity_min = 18.0
    m.initial_velocity_max = 72.0
    m.radial_accel_min = -520.0
    m.radial_accel_max = -260.0
    m.tangential_accel_min = 80.0
    m.tangential_accel_max = 180.0
    m.scale_min = 0.08
    m.scale_max = 0.32
    m.color_ramp = _make_life_ramp()
    p.process_material = m
    return p

func _make_portal_particles() -> GPUParticles2D:
    var p := GPUParticles2D.new()
    p.amount = 120
    p.lifetime = 2.4
    p.one_shot = false
    p.explosiveness = 0.22
    p.randomness = 0.48
    p.emitting = false
    p.texture = glow_texture
    p.visibility_rect = Rect2(-1600, -2800, 3200, 5600)
    p.material = _make_additive_canvas_material()

    var m := ParticleProcessMaterial.new()
    m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_RING
    m.emission_ring_radius = 190.0
    m.emission_ring_inner_radius = 145.0
    m.direction = Vector3(0.0, -1.0, 0.0)
    m.spread = 180.0
    m.gravity = Vector3.ZERO
    m.initial_velocity_min = 22.0
    m.initial_velocity_max = 90.0
    m.tangential_accel_min = 65.0
    m.tangential_accel_max = 145.0
    m.scale_min = 0.06
    m.scale_max = 0.28
    m.color_ramp = _make_life_ramp()
    p.process_material = m
    return p

func _make_additive_canvas_material() -> CanvasItemMaterial:
    var material := CanvasItemMaterial.new()
    material.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
    return material

func _make_life_ramp() -> GradientTexture1D:
    var gradient := Gradient.new()
    gradient.offsets = PackedFloat32Array([0.0, 0.08, 0.62, 1.0])
    gradient.colors = PackedColorArray([
        Color(1.0, 1.0, 1.0, 0.0),
        Color(1.0, 1.0, 1.0, 1.0),
        Color(1.0, 1.0, 1.0, 0.58),
        Color(1.0, 1.0, 1.0, 0.0)
    ])
    var texture := GradientTexture1D.new()
    texture.gradient = gradient
    return texture

func _make_glow_texture(size: int) -> Texture2D:
    var image := Image.create(size, size, false, Image.FORMAT_RGBA8)
    var center := Vector2(float(size - 1) * 0.5, float(size - 1) * 0.5)
    var radius := float(size) * 0.5
    for y in range(size):
        for x in range(size):
            var d := Vector2(float(x), float(y)).distance_to(center) / radius
            var alpha := pow(max(0.0, 1.0 - d), 2.25)
            image.set_pixel(x, y, Color(1.0, 1.0, 1.0, alpha))
    return ImageTexture.create_from_image(image)

func _resize_world() -> void:
    var size := get_viewport_rect().size
    if background != null:
        background.position = Vector2.ZERO
        background.size = size

func _apply_world_plan(plan: Dictionary) -> void:
    current_plan = current_plan.duplicate(true)
    for key in plan.keys():
        current_plan[key] = plan[key]

    var palette = current_plan.get("palette", {})
    var primary := _safe_color(String(palette.get("primary", "#070B1A")), Color("#070B1A"))
    var secondary := _safe_color(String(palette.get("secondary", "#172554")), Color("#172554"))
    var accent := _safe_color(String(palette.get("accent", "#7DD3FC")), Color("#7DD3FC"))

    background.color = primary
    background_material.set_shader_parameter("primary_color", primary)
    background_material.set_shader_parameter("secondary_color", secondary)
    background_material.set_shader_parameter("accent_color", accent)
    background_material.set_shader_parameter("density", clamp(float(current_plan.get("density", 0.48)), 0.0, 1.0))
    background_material.set_shader_parameter("motion", clamp(float(current_plan.get("motion", 0.42)), 0.0, 1.0))
    background_material.set_shader_parameter("particle_level", clamp(float(current_plan.get("particleLevel", 0.55)), 0.0, 1.0))
    background_material.set_shader_parameter("pulse_strength", clamp(float(current_plan.get("pulseStrength", 0.62)), 0.0, 1.0))
    background_material.set_shader_parameter("contrast_level", clamp(float(current_plan.get("contrastLevel", 0.68)), 0.0, 1.0))
    background_material.set_shader_parameter("layout_mode", int(LAYOUTS.get(String(current_plan.get("layout", "FIELD")), 0)))
    background_material.set_shader_parameter("environment_mode", int(ENVIRONMENTS.get(String(current_plan.get("environment", "STARDUST")), 1)))
    background_material.set_shader_parameter("material_mode", int(MATERIALS.get(String(current_plan.get("materialStyle", "ENERGY")), 3)))
    background_material.set_shader_parameter("composition_mode", int(COMPOSITIONS.get(String(current_plan.get("composition", "CLUSTERED")), 4)))
    background_material.set_shader_parameter("glitch_seed", float(last_seq % 113) * 0.17)

    overlay.call("set_palette", accent, secondary)
    _recolor_particles(accent, secondary)

func _recolor_particles(accent: Color, secondary: Color) -> void:
    var burst_mat := burst_particles.process_material as ParticleProcessMaterial
    var gravity_mat := gravity_particles.process_material as ParticleProcessMaterial
    var portal_mat := portal_particles.process_material as ParticleProcessMaterial
    if burst_mat != null:
        burst_mat.color = accent
    if gravity_mat != null:
        gravity_mat.color = Color(accent.r, accent.g, accent.b, 0.86)
    if portal_mat != null:
        portal_mat.color = secondary.lerp(accent, 0.62)

func _handle_tap(data: Dictionary) -> void:
    var x := clamp(float(data.get("x", 0.5)), 0.0, 1.0)
    var y := clamp(float(data.get("y", 0.5)), 0.0, 1.0)
    var momentum := clamp(float(data.get("momentum", 0.0)), 0.0, 1.0)
    var reaction := String(data.get("reaction", current_plan.get("tapReaction", "BLOOM")))
    var pulse := clamp(float(data.get("pulseStrength", current_plan.get("pulseStrength", 0.62))), 0.0, 1.0)
    last_tap = Vector2(x, y)

    var px := Vector2(x * get_viewport_rect().size.x, y * get_viewport_rect().size.y)
    var strength := clamp(0.38 + pulse * 0.50 + momentum * 0.34, 0.0, 1.25)

    shock_progress = 0.0
    shock_strength = max(shock_strength, 0.72 + strength * 0.75)
    flash_strength = max(flash_strength, 0.18 + strength * 0.32)
    background_material.set_shader_parameter("tap_pos", last_tap)

    burst_particles.position = px
    burst_particles.amount_ratio = clamp(0.35 + float(current_plan.get("particleLevel", 0.55)) * 0.65, 0.25, 1.0)
    burst_particles.restart()
    burst_particles.emitting = true

    overlay.call("add_tap", px, reaction, min(1.0, strength))

    if reaction == "ATTRACT":
        _trigger_gravity(px, strength)
    elif reaction == "REPEL":
        shock_strength = max(shock_strength, 1.55)
    elif reaction == "MULTIPLY":
        _trigger_portal(px, strength * 0.8)
        _spawn_satellite_bursts(px, 3)
    elif reaction == "WARP":
        _trigger_gravity(px, strength * 0.65)
        _trigger_portal(px, strength)
        shock_strength = max(shock_strength, 1.65)
    elif reaction == "CRACK":
        shock_strength = max(shock_strength, 1.15)
    elif reaction == "BLOOM":
        portal_strength = max(portal_strength, strength * 0.42)
    elif reaction == "RIPPLE":
        shock_strength = max(shock_strength, 1.28)

func _handle_effect(data: Dictionary) -> void:
    var name := String(data.get("name", ""))
    var x := clamp(float(data.get("x", 0.5)), 0.0, 1.0)
    var y := clamp(float(data.get("y", 0.5)), 0.0, 1.0)
    var strength := clamp(float(data.get("strength", 0.7)), 0.0, 1.0)
    var px := Vector2(x * get_viewport_rect().size.x, y * get_viewport_rect().size.y)
    last_tap = Vector2(x, y)
    background_material.set_shader_parameter("tap_pos", last_tap)

    if name == "portal" or name == "spawn_portal":
        _trigger_portal(px, strength)
    elif name == "black_hole" or name == "gravity_pull":
        _trigger_gravity(px, strength)
    elif name == "shockwave":
        shock_progress = 0.0
        shock_strength = max(shock_strength, 0.7 + strength * 1.1)
    elif name == "particle_burst":
        burst_particles.position = px
        burst_particles.restart()
        burst_particles.emitting = true
    elif name == "world_crack" or name == "glitch_world":
        overlay.call("add_tap", px, "CRACK", strength)
        shock_progress = 0.0
        shock_strength = max(shock_strength, 1.2)

func _trigger_gravity(px: Vector2, strength: float) -> void:
    gravity_strength = max(gravity_strength, 0.65 + strength * 0.85)
    gravity_particles.position = px
    var gm := gravity_particles.process_material as ParticleProcessMaterial
    if gm != null:
        gm.emission_sphere_radius = 190.0 + strength * 260.0
        gm.radial_accel_min = -340.0 - strength * 260.0
        gm.radial_accel_max = -190.0 - strength * 180.0
    gravity_particles.restart()
    gravity_particles.emitting = true
    gravity_stop_at = Time.get_ticks_msec() / 1000.0 + 1.55 + strength * 0.75

func _trigger_portal(px: Vector2, strength: float) -> void:
    portal_strength = max(portal_strength, 0.72 + strength * 0.88)
    portal_particles.position = px
    portal_particles.restart()
    portal_particles.emitting = true
    portal_stop_at = Time.get_ticks_msec() / 1000.0 + 2.0 + strength * 1.1

func _spawn_satellite_bursts(px: Vector2, count: int) -> void:
    # The shader/overlay carry the multiple focal points visually. Keep a single GPU emitter here
    # to avoid allocating particle nodes during play; offset it once for a secondary explosion.
    if count <= 0:
        return
    var angle := float(last_seq % 17) * 0.71
    burst_particles.position = px + Vector2(cos(angle), sin(angle)) * 120.0
    burst_particles.restart()
    burst_particles.emitting = true

func _sync_dynamic_uniforms() -> void:
    if background_material == null:
        return
    background_material.set_shader_parameter("shock_progress", shock_progress)
    background_material.set_shader_parameter("shock_strength", shock_strength)
    background_material.set_shader_parameter("portal_strength", portal_strength)
    background_material.set_shader_parameter("gravity_strength", gravity_strength)
    background_material.set_shader_parameter("flash_strength", flash_strength)

func _reset_vfx() -> void:
    shock_progress = 1.0
    shock_strength = 0.0
    portal_strength = 0.0
    gravity_strength = 0.0
    flash_strength = 0.0
    last_tap = Vector2(0.5, 0.5)
    gravity_particles.emitting = false
    portal_particles.emitting = false
    burst_particles.emitting = false
    overlay.call("reset")
    background_material.set_shader_parameter("tap_pos", last_tap)
    _sync_dynamic_uniforms()

func _safe_color(value: String, fallback: Color) -> Color:
    if value.begins_with("#") and (value.length() == 7 or value.length() == 9):
        return Color(value)
    return fallback
