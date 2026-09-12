shader_type canvas_item;
render_mode unshaded;

// 0.20.2 mobile-safe VFX shader.
// The previous version evaluated ~35 value-noise layers per pixel. This version intentionally
// uses a handful of noise samples and analytic shapes so a full-screen portrait render can stay
// inside a reasonable mobile GPU budget.
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

float ring_line(float d, float r, float width) {
    return 1.0 - smoothstep(0.0, width, abs(d - r));
}

float stars(vec2 uv, float scale, float threshold) {
    vec2 g = uv * scale;
    vec2 cell = fract(g) - 0.5;
    float h = hash21(floor(g));
    float core = 1.0 - smoothstep(0.01, 0.07, length(cell));
    return core * step(threshold, h);
}

void fragment() {
    vec2 uv = UV;
    float aspect = SCREEN_PIXEL_SIZE.y / max(SCREEN_PIXEL_SIZE.x, 0.000001);
    vec2 av = vec2(aspect, 1.0);
    vec2 p = (uv - 0.5) * 2.0 * av;
    vec2 tp = (tap_pos - 0.5) * 2.0 * av;
    float t = TIME * (0.18 + motion * 0.62);

    vec2 td = p - tp;
    float tap_dist = length(td);
    float shock_radius = mix(0.02, 1.22, shock_progress);
    float shock_band = exp(-abs(tap_dist - shock_radius) * 34.0) * shock_strength;
    p += td / max(tap_dist, 0.02) * shock_band * 0.045;

    // Two animated value-noise fields + one cheap detail sample replace the previous 5-octave
    // multi-FBM domain warp. This is the main thermal reduction.
    float n1 = noise2(p * (1.5 + density * 0.8) + vec2(t * 0.22, -t * 0.15));
    float n2 = noise2(p * 3.1 + vec2(-t * 0.17, t * 0.13) + n1 * 1.7);
    float detail = noise2(p * 6.2 + vec2(t * 0.07, -t * 0.05));
    float nebula = clamp(n1 * 0.62 + n2 * 0.30 + detail * 0.08, 0.0, 1.0);

    vec3 pri = primary_color.rgb;
    vec3 sec = secondary_color.rgb;
    vec3 acc = accent_color.rgb;
    vec3 col = mix(pri, sec, smoothstep(0.20, 0.82, nebula));
    col += acc * pow(max(nebula - 0.56, 0.0), 2.0) * (1.1 + density * 2.4);

    float r = length(p);
    float a = atan(p.y, p.x);

    // Composition: analytic weighting only, no extra noise calls.
    if (composition_mode == 0) {
        col *= 0.68 + exp(-r * 2.2) * 0.92;
    } else if (composition_mode == 1) {
        col *= 0.56 + smoothstep(0.25, 1.1, r) * 0.92;
    } else if (composition_mode == 2) {
        col *= 0.72 + exp(-abs(p.y - p.x * 0.58) * 2.6) * 0.68;
    } else if (composition_mode == 3) {
        float s = 0.5 + 0.5 * sin(a * 3.0 - r * 10.0 + t);
        col *= 0.72 + s * s * 0.46;
    } else if (composition_mode == 4) {
        col *= 0.72 + smoothstep(0.38, 0.74, n1) * 0.62;
    } else {
        col *= 0.56 + smoothstep(0.22, 0.70, r) * 0.88;
    }

    // Distinct world layouts, using rings/lines instead of more fractal noise.
    if (layout_mode == 1) { // TUNNEL
        float rings = pow(0.5 + 0.5 * sin(r * 30.0 - t * 4.0), 8.0);
        float spokes = pow(0.5 + 0.5 * sin(a * 10.0 + t), 12.0);
        col += acc * (rings * 0.95 + spokes * 0.16) * smoothstep(0.08, 0.9, r);
    } else if (layout_mode == 2) { // VORTEX
        float spiral = pow(0.5 + 0.5 * sin(a * 6.0 - r * 24.0 + t * 3.4), 8.0);
        col += acc * spiral * (0.28 + exp(-r * 3.2) * 1.55);
    } else if (layout_mode == 3) { // GATE
        float gate_r = length(vec2(p.x * 1.55, p.y));
        float gate = ring_line(gate_r, 0.62 + sin(t) * 0.02, 0.034);
        float inner = ring_line(gate_r, 0.49, 0.013);
        col += acc * (gate * 1.9 + inner * 0.65);
    } else if (layout_mode == 4) { // SHARD_STORM
        vec2 q = p + vec2(p.y * 0.52 + t * 0.65, 0.0);
        vec2 cell = fract(q * vec2(8.0, 15.0)) - 0.5;
        float h = hash21(floor(q * vec2(8.0, 15.0)) + glitch_seed);
        float shard = (1.0 - smoothstep(0.018, 0.07, abs(cell.x + cell.y * 0.22))) * step(0.66, h);
        col += mix(sec, acc, h) * shard * (0.55 + particle_level * 1.25);
    } else {
        col += acc * exp(-r * 1.9) * 0.12;
    }

    // Environment overlays stay intentionally cheap.
    if (environment_mode == 0) { // FOG
        col = mix(col, sec + pri, n1 * 0.18 * particle_level);
    } else if (environment_mode == 1) { // STARDUST
        col += acc * (stars(uv + vec2(t * 0.002, 0.0), 38.0, 0.975 - particle_level * 0.018) * 1.4
                    + stars(uv * 1.13, 74.0, 0.993) * 0.55);
    } else if (environment_mode == 2) { // SMOKE
        col *= 0.78 + n2 * 0.34;
    } else if (environment_mode == 3) { // BUBBLES
        vec2 bg = uv * vec2(8.0, 14.0) + vec2(0.0, -t * 0.15);
        vec2 bf = fract(bg) - 0.5;
        float h = hash21(floor(bg));
        col += acc * ring_line(length(bf), mix(0.13, 0.34, h), 0.025) * step(0.48, h) * 0.55;
    } else if (environment_mode == 4) { // ASH
        vec2 ag = uv * vec2(36.0, 16.0) + vec2(t * 0.18, t * 0.7);
        vec2 af = fract(ag) - 0.5;
        float h = hash21(floor(ag));
        col += mix(vec3(0.9, 0.22, 0.05), acc, 0.3) * (1.0 - smoothstep(0.0, 0.06, length(af))) * step(0.86, h);
    } else if (environment_mode == 5) { // POLLEN
        col += mix(acc, vec3(1.0, 0.82, 0.25), 0.45) * stars(uv, 44.0, 0.97 - particle_level * 0.02);
    } else { // GLITCH
        float row = floor(uv.y * 78.0 + t * 5.0);
        float g = step(0.90, hash21(vec2(row, floor(t * 2.0) + glitch_seed)));
        col += acc * g * (0.12 + 0.12 * sin(uv.x * 120.0 + row));
    }

    // Material identity is now mostly transfer-function based (cheap).
    if (material_mode == 0) { // GLASS
        col += acc * pow(abs(detail - 0.5) * 2.0, 7.0) * 0.15;
    } else if (material_mode == 1) { // METAL
        col = mix(col * 0.72, col * 1.25, step(0.58, detail));
    } else if (material_mode == 2) { // BIO
        col += acc * pow(0.5 + 0.5 * sin(n2 * 13.0 + t * 2.0), 8.0) * 0.16;
    } else if (material_mode == 3) { // ENERGY
        col += acc * pow(max(nebula - 0.50, 0.0), 3.0) * (1.6 + pulse_strength * 1.6);
    } else if (material_mode == 4) { // CRYSTAL
        float facet = abs(fract((p.x + p.y * 0.62 + detail * 0.14) * 6.0) - 0.5);
        col += acc * pow(1.0 - smoothstep(0.38, 0.5, facet), 7.0) * 0.22;
    } else { // INK
        float mono = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(pri * 0.55, acc * 0.68, smoothstep(0.35, 0.66, mono));
    }

    // Tap focal effects.
    vec2 pd = p - tp;
    float pr = length(pd);
    float pa = atan(pd.y, pd.x);
    float portal = ring_line(pr, 0.18 + 0.014 * sin(t * 2.4), 0.018)
                 + ring_line(pr, 0.27, 0.010) * 0.45;
    float swirl = pow(0.5 + 0.5 * sin(pa * 8.0 - pr * 28.0 + t * 5.0), 8.0) * exp(-pr * 5.0);
    col += acc * (portal * 1.7 + swirl * 0.55) * portal_strength;

    float black_core = exp(-pr * 22.0) * gravity_strength;
    col *= 1.0 - black_core * 0.90;
    col += acc * ring_line(pr, 0.12, 0.020) * gravity_strength * 1.35;
    col += acc * shock_band * (0.95 + pulse_strength * 1.4);
    col += acc * flash_strength * 0.25;

    float contrast = mix(0.86, 1.26, contrast_level);
    col = max((col - 0.5) * contrast + 0.5, vec3(0.0));
    col = vec3(1.0) - exp(-col * (1.15 + contrast_level * 0.38));
    COLOR = vec4(col, 1.0);
}
