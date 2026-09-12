shader_type canvas_item;
render_mode unshaded;

uniform vec4 primary_color : source_color = vec4(0.02, 0.04, 0.12, 1.0);
uniform vec4 secondary_color : source_color = vec4(0.08, 0.20, 0.55, 1.0);
uniform vec4 accent_color : source_color = vec4(0.48, 0.83, 1.0, 1.0);
uniform float density : hint_range(0.0, 1.0) = 0.5;
uniform float motion : hint_range(0.0, 1.0) = 0.45;
uniform float contrast_level : hint_range(0.0, 1.0) = 0.7;
uniform float particle_level : hint_range(0.0, 1.0) = 0.55;
uniform float pulse_strength : hint_range(0.0, 1.0) = 0.62;
uniform int layout_mode = 0;
uniform int environment_mode = 1;
uniform int material_mode = 3;
uniform int composition_mode = 4;
uniform vec2 tap_pos = vec2(0.5, 0.5);
uniform float shock_progress : hint_range(0.0, 1.0) = 1.0;
uniform float shock_strength : hint_range(0.0, 2.0) = 0.0;
uniform float portal_strength : hint_range(0.0, 2.0) = 0.0;
uniform float gravity_strength : hint_range(0.0, 2.0) = 0.0;
uniform float flash_strength : hint_range(0.0, 1.0) = 0.0;
uniform float glitch_seed = 0.0;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.52;
    mat2 rot = mat2(vec2(0.80, 0.60), vec2(-0.60, 0.80));
    for (int i = 0; i < 5; i++) {
        v += a * noise2(p);
        p = rot * p * 2.03 + 13.7;
        a *= 0.5;
    }
    return v;
}

float star_field(vec2 uv, float scale, float threshold) {
    vec2 g = uv * scale;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash21(id);
    float radius = mix(0.032, 0.085, h);
    float dot_star = (1.0 - smoothstep(0.0, radius, length(f))) * step(threshold, h);
    float cross_x = (1.0 - smoothstep(0.0, 0.018, abs(f.x))) * (1.0 - smoothstep(0.05, 0.28, abs(f.y)));
    float cross_y = (1.0 - smoothstep(0.0, 0.018, abs(f.y))) * (1.0 - smoothstep(0.05, 0.28, abs(f.x)));
    return max(dot_star, (cross_x + cross_y) * 0.35 * step(0.988, h));
}

float ring_line(float d, float r, float width) {
    return 1.0 - smoothstep(0.0, width, abs(d - r));
}

void fragment() {
    vec2 uv = UV;
    float aspect = SCREEN_PIXEL_SIZE.y / max(SCREEN_PIXEL_SIZE.x, 0.000001);
    vec2 aspect_vec = vec2(aspect, 1.0);
    vec2 p = (uv - 0.5) * 2.0 * aspect_vec;
    vec2 tp = (tap_pos - 0.5) * 2.0 * aspect_vec;
    float t = TIME * (0.18 + motion * 0.95);

    // Tap shockwave bends the procedural domain before any world pattern is evaluated.
    vec2 td = p - tp;
    float tap_dist = length(td);
    float shock_radius = mix(0.015, 1.25, shock_progress);
    float shock_band = exp(-abs(tap_dist - shock_radius) * 42.0) * shock_strength;
    vec2 tap_dir = td / max(tap_dist, 0.001);
    p += tap_dir * shock_band * (0.035 + 0.055 * pulse_strength) * (1.0 - shock_progress * 0.55);

    // Gravity events twist the whole field around the tap. This is deliberately bounded so the
    // player gets a strong warp without causing NaNs near the center.
    vec2 gd = p - tp;
    float gr = max(length(gd), 0.035);
    float ga = gravity_strength * exp(-gr * 2.7);
    float cs = cos(ga * 1.7);
    float sn = sin(ga * 1.7);
    gd = mat2(vec2(cs, -sn), vec2(sn, cs)) * gd;
    p = tp + gd * (1.0 - ga * 0.12);

    vec2 warp_a = vec2(
        fbm(p * 1.15 + vec2(t * 0.20, -t * 0.12)),
        fbm(p * 1.15 + vec2(-t * 0.16, t * 0.18) + 7.3)
    );
    vec2 warp_b = vec2(
        fbm(p * 2.1 + warp_a * 2.2 + 19.1),
        fbm(p * 2.0 - warp_a * 1.8 - 11.7)
    );
    float nebula = fbm(p * (1.15 + density * 0.85) + warp_a * 1.55 + warp_b * 0.55);
    float veins = fbm(p * 4.3 + warp_b * 2.2 + t * 0.08);

    vec3 pri = primary_color.rgb;
    vec3 sec = secondary_color.rgb;
    vec3 acc = accent_color.rgb;
    vec3 col = mix(pri, sec, smoothstep(0.22, 0.88, nebula));
    col += acc * pow(max(nebula - 0.57, 0.0), 2.0) * (1.5 + density * 3.0);

    float r = length(p);
    float a = atan(p.y, p.x);

    // Composition changes where visual weight lives, so repeated worlds do not all read as a
    // centered wallpaper. It is deterministic and cheap enough to change every AI turn.
    float composition_gain = 1.0;
    if (composition_mode == 0) { // CENTER
        composition_gain = 0.72 + exp(-r * 2.25) * 0.88;
    } else if (composition_mode == 1) { // EDGE
        composition_gain = 0.55 + smoothstep(0.28, 1.15, r) * 0.95;
    } else if (composition_mode == 2) { // DIAGONAL
        float diag = exp(-abs(p.y - p.x * 0.58) * 2.5);
        composition_gain = 0.72 + diag * 0.72;
    } else if (composition_mode == 3) { // SPIRAL
        float comp_spiral = 0.5 + 0.5 * sin(a * 3.0 - r * 11.0 + t * 0.55);
        composition_gain = 0.72 + pow(comp_spiral, 4.0) * 0.66;
    } else if (composition_mode == 4) { // CLUSTERED
        float cluster = fbm(p * 1.35 + vec2(6.8, -3.7));
        composition_gain = 0.70 + smoothstep(0.42, 0.78, cluster) * 0.70;
    } else { // HOLLOW_CENTER
        composition_gain = 0.54 + smoothstep(0.24, 0.72, r) * 0.90;
    }
    col *= composition_gain;

    // Each layout has a distinct visual grammar, instead of rearranging the same primitives.
    if (layout_mode == 1) { // TUNNEL
        float perspective = 1.0 / max(r + 0.15, 0.15);
        float rings = 0.5 + 0.5 * sin(r * 34.0 - t * 5.0 + nebula * 2.5);
        float spokes = 0.5 + 0.5 * sin(a * 12.0 + t * 0.9);
        float tunnel = pow(rings, 8.0) * 0.85 + pow(spokes, 12.0) * 0.20;
        col += acc * tunnel * (1.0 - smoothstep(0.5, 2.8, perspective)) * 1.3;
        col *= 0.75 + smoothstep(0.05, 0.9, r) * 0.45;
    } else if (layout_mode == 2) { // VORTEX
        float spiral = 0.5 + 0.5 * sin(a * 7.0 - r * 27.0 + t * 4.2 + nebula * 4.0);
        float core = exp(-r * 3.6);
        col += acc * pow(spiral, 9.0) * (0.35 + core * 2.0);
        col += sec * core * 1.3;
    } else if (layout_mode == 3) { // GATE
        vec2 ep = vec2(p.x * 1.55, p.y);
        float gate_r = length(ep);
        float gate = ring_line(gate_r, 0.62 + sin(t * 0.8) * 0.025, 0.035);
        float inner = ring_line(gate_r, 0.49, 0.012);
        float pillar = (1.0 - smoothstep(0.0, 0.025, abs(abs(p.x) - 0.43))) * (1.0 - smoothstep(0.1, 1.0, abs(p.y)));
        col += acc * (gate * 2.3 + inner * 0.8 + pillar * 0.42);
        col *= 0.78 + smoothstep(0.0, 0.95, gate_r) * 0.3;
    } else if (layout_mode == 4) { // SHARD_STORM
        vec2 q = p;
        q.x += q.y * 0.62 + t * 0.9;
        vec2 cell = fract(q * vec2(9.0, 17.0)) - 0.5;
        float shard_hash = hash21(floor(q * vec2(9.0, 17.0)) + glitch_seed);
        float shard = (1.0 - smoothstep(0.02, 0.08, abs(cell.x + cell.y * 0.23))) * step(0.60, shard_hash);
        col += mix(sec, acc, shard_hash) * shard * (0.75 + particle_level * 1.8);
    } else { // FIELD
        float halo = exp(-r * 1.8) * (0.1 + 0.2 * sin(t + nebula * 4.0));
        col += acc * halo * 0.55;
    }

    // Environment overlays are cheap procedural layers, so AI can change ambience every turn.
    if (environment_mode == 0) { // FOG
        float fog = fbm(p * 0.85 + vec2(t * 0.09, -t * 0.04));
        col = mix(col, sec + pri, fog * 0.32 * particle_level);
    } else if (environment_mode == 1) { // STARDUST
        float stars = star_field(uv + vec2(t * 0.002, -t * 0.0015), 34.0 + particle_level * 28.0, 0.965 - particle_level * 0.025);
        float stars2 = star_field(uv * 1.17 - vec2(t * 0.001, 0.0), 78.0, 0.991);
        col += acc * (stars * 1.6 + stars2 * 0.7);
    } else if (environment_mode == 2) { // SMOKE
        float smoke = fbm(p * 1.65 + warp_b * 1.8 + vec2(0.0, -t * 0.22));
        col *= 0.72 + smoke * 0.46;
        col += sec * pow(smoke, 3.0) * 0.24;
    } else if (environment_mode == 3) { // BUBBLES
        vec2 bg = uv * vec2(9.0, 15.0) + vec2(sin(t * 0.2), -t * 0.22);
        vec2 bid = floor(bg);
        vec2 bf = fract(bg) - 0.5;
        float bh = hash21(bid);
        float br = mix(0.11, 0.36, bh);
        float bubble = ring_line(length(bf), br, 0.028) * step(0.42, bh);
        col += acc * bubble * (0.45 + particle_level);
    } else if (environment_mode == 4) { // ASH
        vec2 av = uv * vec2(45.0, 18.0) + vec2(t * 0.34, t * 1.15);
        vec2 af = fract(av) - 0.5;
        float ah = hash21(floor(av));
        float ash = (1.0 - smoothstep(0.0, 0.08, length(vec2(af.x * 4.0, af.y)))) * step(0.78 - particle_level * 0.18, ah);
        col += mix(vec3(0.8, 0.2, 0.05), acc, 0.35) * ash * 0.9;
    } else if (environment_mode == 5) { // POLLEN
        float pollen = star_field(uv + vec2(sin(t * 0.13), -t * 0.008), 42.0, 0.95 - particle_level * 0.025);
        col += mix(acc, vec3(1.0, 0.82, 0.25), 0.45) * pollen * 1.3;
    } else { // GLITCH
        float row = floor(uv.y * 94.0 + t * 7.0);
        float g = step(0.84, hash21(vec2(row, floor(t * 2.0) + glitch_seed)));
        float band = g * (0.5 + 0.5 * sin(uv.x * 160.0 + row));
        col += acc * band * 0.35 * particle_level;
        col.r += g * 0.05;
        col.b += g * 0.09;
    }

    // Material identity changes how highlights are shaped, not just the palette.
    if (material_mode == 0) { // GLASS
        float rim = pow(1.0 - abs(sin(veins * 5.5)), 8.0);
        col += acc * rim * 0.22;
        col = mix(col, vec3(col.b, col.r, col.g), 0.035 + shock_band * 0.03);
    } else if (material_mode == 1) { // METAL
        float hard = step(0.62, veins);
        col = mix(col * 0.64, col * 1.35 + acc * 0.12, hard);
    } else if (material_mode == 2) { // BIO
        float bio = pow(0.5 + 0.5 * sin(veins * 17.0 + t * 2.3), 10.0);
        col += acc * bio * (0.20 + pulse_strength * 0.55);
    } else if (material_mode == 3) { // ENERGY
        col += acc * pow(max(nebula - 0.48, 0.0), 3.0) * (2.2 + pulse_strength * 2.2);
    } else if (material_mode == 4) { // CRYSTAL
        float facets = abs(fract((p.x + p.y * 0.63 + veins * 0.18) * 7.0) - 0.5);
        float edge = 1.0 - smoothstep(0.44, 0.50, facets);
        col += acc * pow(edge, 9.0) * 0.45;
    } else { // INK
        float mono = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(pri * 0.45, acc * 0.8, smoothstep(0.36, 0.67, mono + veins * 0.18));
    }

    // Portal / black-hole layer. Last tap becomes a temporary focal point in the world.
    vec2 pd = p - tp;
    float pr = length(pd);
    float pa = atan(pd.y, pd.x);
    float portal_ring = ring_line(pr, 0.16 + 0.018 * sin(t * 2.7), 0.016);
    float portal_ring2 = ring_line(pr, 0.25 + 0.012 * cos(t * 2.1), 0.010);
    float portal_swirl = pow(0.5 + 0.5 * sin(pa * 9.0 - pr * 34.0 + t * 6.0), 10.0) * exp(-pr * 5.0);
    col += acc * (portal_ring * 2.2 + portal_ring2 * 0.8 + portal_swirl) * portal_strength;

    float black_core = exp(-pr * 25.0) * gravity_strength;
    float accretion = ring_line(pr, 0.115, 0.020) * gravity_strength;
    col *= 1.0 - black_core * 0.92;
    col += mix(acc, vec3(1.0), 0.35) * accretion * 2.0;

    // Shockwave and exposure kick are intentionally last so taps always read immediately.
    col += acc * shock_band * (1.25 + pulse_strength * 1.75);
    col += acc * flash_strength * 0.32;

    float contrast = mix(0.78, 1.38, contrast_level);
    col = (col - 0.5) * contrast + 0.5;
    // Simple filmic-ish compression keeps additive VFX vivid without hard clipping.
    col = max(col, vec3(0.0));
    col = vec3(1.0) - exp(-col * (1.25 + contrast_level * 0.55));

    COLOR = vec4(col, 1.0);
}
