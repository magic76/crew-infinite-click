package com.magic76.aiclicker;

import org.godotengine.godot.Godot;
import org.godotengine.godot.plugin.GodotPlugin;
import org.godotengine.godot.plugin.SignalInfo;
import org.godotengine.godot.plugin.UsedByGodot;

import java.util.Collections;
import java.util.Set;

/** Runtime Godot plugin used only as a typed signal transport into GDScript. */
final class VisualBridgePlugin extends GodotPlugin {
    static final String PLUGIN_NAME = "InfiniteClickBridge";
    static final String VISUAL_COMMAND = "visual_command";

    private static final SignalInfo VISUAL_COMMAND_SIGNAL =
            new SignalInfo(VISUAL_COMMAND, String.class);

    private final GodotWorldBridge bridge;

    VisualBridgePlugin(Godot godot, GodotWorldBridge bridge) {
        super(godot);
        this.bridge = bridge;
    }

    @Override public String getPluginName() {
        return PLUGIN_NAME;
    }

    @Override public Set<SignalInfo> getPluginSignals() {
        return Collections.singleton(VISUAL_COMMAND_SIGNAL);
    }

    @Override public void onGodotMainLoopStarted() {
        super.onGodotMainLoopStarted();
        // Redundant with the GodotHost callback on MainActivity. Keeping both makes startup
        // tolerant to lifecycle ordering differences between embedded-engine versions.
        if (bridge != null) bridge.onGodotMainLoopStarted();
    }

    @UsedByGodot
    public void reportStage(String stage) {
        if (bridge != null) bridge.onGodotStage(stage);
    }

    @UsedByGodot
    public void reportSceneReady() {
        if (bridge != null) bridge.onGodotSceneReady();
    }

    void emitVisualCommand(String payload) {
        if (payload == null || payload.isEmpty()) return;
        emitSignal(VISUAL_COMMAND, payload);
    }
}
