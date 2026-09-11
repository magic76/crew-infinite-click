package com.magic76.aiclicker;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Random;

/**
 * Local procedural renderer for the endless AI world.
 * Gemini chooses a WorldPlan; this class animates it continuously at frame rate.
 */
final class LivingWorldEngine {
    private static final int MAX_NODES = 56;
    private static final int MAX_PULSES = 16;

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final Random random = new Random();
    private final List<Node> nodes = new ArrayList<>();
    private final List<Pulse> pulses = new ArrayList<>();

    private WorldPlan plan = WorldPlan.defaultPlan();
    private long planAppliedAt = System.currentTimeMillis();
    private long lastFrameAt = System.currentTimeMillis();
    private float energy = 0.16f;
    private float lastTapX = 0.5f;
    private float lastTapY = 0.5f;

    void reset() {
        plan = WorldPlan.defaultPlan();
        nodes.clear();
        pulses.clear();
        energy = 0.16f;
        lastTapX = 0.5f;
        lastTapY = 0.5f;
        planAppliedAt = System.currentTimeMillis();
        lastFrameAt = planAppliedAt;
        rebuildNodes(true);
    }

    WorldPlan currentPlan() { return plan; }

    void applyPlan(WorldPlan next) {
        if (next == null) return;
        boolean topologyChanged = !next.theme.equals(plan.theme) || !next.motif.equals(plan.motif);
        plan = next;
        planAppliedAt = System.currentTimeMillis();
        if (topologyChanged) rebuildNodes(true);
        else rebuildNodes(false);
        energy = clamp(energy + 0.12f, 0f, 1f);
    }

    void onTap(float x, float y, double momentum) {
        lastTapX = clamp(x, 0f, 1f);
        lastTapY = clamp(y, 0f, 1f);
        energy = clamp(energy + 0.08f + (float)momentum * 0.08f, 0f, 1f);

        String reaction = plan.tapReaction;
        if ("BLOOM".equals(reaction) || "MULTIPLY".equals(reaction)) {
            int count = "MULTIPLY".equals(reaction) ? 4 : 2;
            for (int i = 0; i < count && nodes.size() < MAX_NODES; i++) {
                float a = (float)(random.nextDouble() * Math.PI * 2.0);
                float d = 0.03f + random.nextFloat() * 0.08f;
                nodes.add(new Node(
                        clamp(lastTapX + (float)Math.cos(a) * d, 0.04f, 0.96f),
                        clamp(lastTapY + (float)Math.sin(a) * d, 0.04f, 0.96f),
                        random.nextFloat() * 6.28f,
                        0.5f + random.nextFloat() * 0.8f));
            }
        } else if ("ATTRACT".equals(reaction) || "REPEL".equals(reaction)) {
            float sign = "ATTRACT".equals(reaction) ? 1f : -1f;
            for (Node n : nodes) {
                float dx = lastTapX - n.x;
                float dy = lastTapY - n.y;
                n.vx += dx * 0.16f * sign;
                n.vy += dy * 0.16f * sign;
            }
        } else if ("WARP".equals(reaction)) {
            for (Node n : nodes) n.phase += 1.1f + random.nextFloat() * 0.8f;
        }

        pulses.add(new Pulse(lastTapX, lastTapY, System.currentTimeMillis(),
                "CRACK".equals(reaction) ? 760L : 620L,
                reaction));
        while (pulses.size() > MAX_PULSES) pulses.remove(0);
    }

    void draw(Canvas canvas, RectF bounds) {
        long now = System.currentTimeMillis();
        float dt = Math.min(0.045f, Math.max(0.001f, (now - lastFrameAt) / 1000f));
        lastFrameAt = now;
        energy = Math.max(0.08f, energy - dt * 0.045f);

        int primary = parse(plan.primary, Color.rgb(7,11,26));
        int secondary = parse(plan.secondary, Color.rgb(23,37,84));
        int accent = parse(plan.accent, Color.rgb(125,211,252));

        float angleDrift = (float)Math.sin(now * 0.00008 * (0.4 + plan.motion));
        float gx = bounds.left + bounds.width() * (0.5f + angleDrift * 0.3f);
        float gy = bounds.top + bounds.height() * (0.45f - angleDrift * 0.2f);
        paint.setShader(new LinearGradient(bounds.left, bounds.top, gx, gy + bounds.height() * 0.6f,
                primary, secondary, Shader.TileMode.CLAMP));
        canvas.drawRect(bounds, paint);
        paint.setShader(null);

        drawThemeTexture(canvas, bounds, now, accent);
        updateAndDrawNodes(canvas, bounds, now, dt, accent);
        drawPulses(canvas, bounds, now, accent);
    }

    private void rebuildNodes(boolean hard) {
        int desired = Math.max(8, Math.min(MAX_NODES, Math.round(10 + plan.density * 34)));
        if (hard) nodes.clear();
        while (nodes.size() < desired) {
            nodes.add(new Node(0.06f + random.nextFloat() * 0.88f,
                    0.08f + random.nextFloat() * 0.84f,
                    random.nextFloat() * 6.28f,
                    0.45f + random.nextFloat() * 1.1f));
        }
        while (nodes.size() > desired) nodes.remove(nodes.size() - 1);
    }

    private void drawThemeTexture(Canvas canvas, RectF b, long now, int accent) {
        float w = b.width(), h = b.height();
        int alpha = (int)(18 + 30 * plan.density + 24 * energy);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1f);

        if ("CIRCUIT".equals(plan.theme)) {
            paint.setColor(withAlpha(accent, alpha));
            float gap = Math.max(46f, w / 8f);
            float off = (now * 0.018f * plan.motion) % gap;
            for (float x=b.left-gap+off; x<b.right+gap; x+=gap) canvas.drawLine(x,b.top,x,b.bottom,paint);
            for (float y=b.top-gap+off; y<b.bottom+gap; y+=gap) canvas.drawLine(b.left,y,b.right,y,paint);
        } else if ("ABYSS".equals(plan.theme)) {
            paint.setColor(withAlpha(accent, alpha));
            for (int i=0;i<7;i++) {
                float y=b.top+h*(0.18f+i*0.11f);
                path.reset();
                path.moveTo(b.left,y);
                for (int s=1;s<=10;s++) {
                    float x=b.left+w*s/10f;
                    float yy=y+(float)Math.sin(s*0.8 + now*0.0012*plan.motion+i)*12f;
                    path.lineTo(x,yy);
                }
                canvas.drawPath(path,paint);
            }
        } else if ("GARDEN".equals(plan.theme)) {
            paint.setColor(withAlpha(accent, alpha));
            for (int i=0;i<8;i++) {
                float x=b.left+w*(i+0.5f)/8f;
                float top=b.bottom-h*(0.2f+0.1f*(i%4));
                canvas.drawLine(x,b.bottom,x+(float)Math.sin(now*0.001+i)*22f,top,paint);
            }
        } else if ("LAVA".equals(plan.theme)) {
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(withAlpha(accent, alpha+12));
            for (int i=0;i<7;i++) {
                float x=b.left+w*((i*0.137f+(now*0.00001f*plan.motion))%1f);
                float y=b.top+h*(0.15f+(i%5)*0.17f);
                canvas.drawCircle(x,y,18f+12f*(float)Math.sin(now*0.001+i),paint);
            }
        } else if ("ICE".equals(plan.theme)) {
            paint.setColor(withAlpha(accent, alpha));
            for (int i=0;i<12;i++) {
                float x=b.left+w*((i*0.083f+0.04f)%1f);
                float y=b.top+h*((i*0.157f)%1f);
                canvas.save();
                canvas.rotate(45f+(i%3)*15f,x,y);
                canvas.drawRect(x-12f,y-2f,x+12f,y+2f,paint);
                canvas.restore();
            }
        } else {
            // COSMIC / DREAM / INK: slow dust.
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(withAlpha(accent, alpha));
            for (int i=0;i<24;i++) {
                float x=b.left+w*((i*0.077f + now*0.000006f*plan.motion*(1+i%3))%1f);
                float y=b.top+h*((i*0.131f + 0.17f*(i%4))%1f);
                canvas.drawCircle(x,y,1.2f+(i%3),paint);
            }
        }
        paint.setStyle(Paint.Style.FILL);
    }

    private void updateAndDrawNodes(Canvas canvas, RectF b, long now, float dt, int accent) {
        if (nodes.isEmpty()) rebuildNodes(true);
        float motion = 0.012f + plan.motion * 0.065f;
        for (int i=0;i<nodes.size();i++) {
            Node n=nodes.get(i);
            float phase = n.phase + (now-planAppliedAt)*0.00035f*n.speed*(0.4f+plan.motion);
            float driftX=(float)Math.sin(phase*0.83f+i)*motion;
            float driftY=(float)Math.cos(phase*0.67f+i*0.5f)*motion;

            if ("FLOW".equals(plan.evolution)) {
                driftX += motion * 0.9f;
                driftY *= 0.45f;
            } else if ("ORBIT".equals(plan.evolution)) {
                float dx = n.x - 0.5f;
                float dy = n.y - 0.5f;
                driftX += -dy * motion * 1.6f;
                driftY += dx * motion * 1.6f;
            } else if ("BREATHE".equals(plan.evolution)) {
                driftX *= 0.55f;
                driftY *= 0.55f;
            }

            n.vx*=0.94f; n.vy*=0.94f;
            n.x += (driftX+n.vx)*dt;
            n.y += (driftY+n.vy)*dt;
            if (n.x<0.02f) n.x=0.98f; else if (n.x>0.98f) n.x=0.02f;
            if (n.y<0.04f) n.y=0.96f; else if (n.y>0.96f) n.y=0.04f;

            float x=b.left+n.x*b.width();
            float y=b.top+n.y*b.height();
            float sizePulse = 1f;
            if ("PULSE".equals(plan.evolution)) {
                sizePulse = 0.78f + 0.32f * (float)Math.sin(phase * 1.7f);
            } else if ("BREATHE".equals(plan.evolution)) {
                sizePulse = 0.88f + 0.18f * (float)Math.sin(now * 0.0012f);
            } else if ("GROW".equals(plan.evolution)) {
                float age = Math.min(1f, (now - planAppliedAt) / 9000f);
                sizePulse = 0.72f + age * 0.48f;
            }
            float base=(9f+plan.scale*22f)*(0.75f+0.35f*(float)Math.sin(phase))*sizePulse;
            drawMotif(canvas,x,y,base,phase,accent,i);
        }
    }

    private void drawMotif(Canvas canvas,float x,float y,float r,float phase,int accent,int index) {
        int alpha=(int)(95+85*plan.density+50*energy);
        paint.setStrokeWidth(Math.max(1.4f,r*0.10f));
        paint.setColor(withAlpha(accent,Math.min(235,alpha)));

        switch(plan.motif) {
            case "EYES":
                paint.setStyle(Paint.Style.STROKE);
                RectF eye=new RectF(x-r*1.35f,y-r*0.62f,x+r*1.35f,y+r*0.62f);
                canvas.drawOval(eye,paint);
                paint.setStyle(Paint.Style.FILL);
                float dx=clamp((lastTapX-0.5f)*r*0.7f,-r*0.38f,r*0.38f);
                float dy=clamp((lastTapY-0.5f)*r*0.5f,-r*0.25f,r*0.25f);
                canvas.drawCircle(x+dx,y+dy,r*0.24f,paint);
                break;
            case "JELLYFISH":
                paint.setStyle(Paint.Style.STROKE);
                RectF dome=new RectF(x-r,y-r*0.8f,x+r,y+r*0.5f);
                canvas.drawArc(dome,180,180,false,paint);
                for(int k=-2;k<=2;k++) {
                    float tx=x+k*r*0.32f;
                    path.reset(); path.moveTo(tx,y);
                    path.quadTo(tx+(float)Math.sin(phase+k)*r*0.22f,y+r*0.7f,tx,y+r*1.25f);
                    canvas.drawPath(path,paint);
                }
                break;
            case "VINES":
                paint.setStyle(Paint.Style.STROKE);
                path.reset(); path.moveTo(x,y+r);
                path.cubicTo(x-r,y+r*0.3f,x+r,y-r*0.4f,x,y-r);
                canvas.drawPath(path,paint);
                paint.setStyle(Paint.Style.FILL);
                canvas.drawOval(new RectF(x-r*0.6f,y-r*0.1f,x-r*0.15f,y+r*0.25f),paint);
                break;
            case "PORTALS":
                paint.setStyle(Paint.Style.STROKE);
                canvas.drawCircle(x,y,r,paint);
                paint.setStrokeWidth(Math.max(1f,r*0.05f));
                canvas.drawCircle(x,y,r*0.58f,paint);
                break;
            case "SHARDS":
                paint.setStyle(Paint.Style.STROKE);
                path.reset(); path.moveTo(x,y-r); path.lineTo(x+r*0.62f,y);
                path.lineTo(x,y+r); path.lineTo(x-r*0.62f,y); path.close();
                canvas.drawPath(path,paint);
                break;
            case "GLYPHS":
                paint.setStyle(Paint.Style.STROKE);
                canvas.drawCircle(x,y,r*0.7f,paint);
                canvas.drawLine(x-r,y,x+r,y,paint);
                canvas.drawLine(x,y-r,x,y+r,paint);
                break;
            case "STARS":
                paint.setStyle(Paint.Style.STROKE);
                canvas.drawLine(x-r,y,x+r,y,paint);
                canvas.drawLine(x,y-r,x,y+r,paint);
                canvas.drawLine(x-r*0.65f,y-r*0.65f,x+r*0.65f,y+r*0.65f,paint);
                canvas.drawLine(x-r*0.65f,y+r*0.65f,x+r*0.65f,y-r*0.65f,paint);
                break;
            case "ORBS":
            default:
                paint.setStyle(Paint.Style.FILL);
                canvas.drawCircle(x,y,r*0.42f,paint);
                paint.setStyle(Paint.Style.STROKE);
                paint.setColor(withAlpha(accent,Math.max(35,alpha/3)));
                canvas.drawCircle(x,y,r,paint);
                break;
        }
        paint.setStyle(Paint.Style.FILL);
    }

    private void drawPulses(Canvas canvas,RectF b,long now,int accent) {
        Iterator<Pulse> it=pulses.iterator();
        while(it.hasNext()) {
            Pulse p=it.next();
            float t=(now-p.bornAt)/(float)p.lifeMs;
            if(t>=1f){it.remove();continue;}
            float x=b.left+p.x*b.width(), y=b.top+p.y*b.height();
            float max=Math.min(b.width(),b.height())*(0.12f+0.24f*(1f-t+energy*0.3f));
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(1.5f+5f*(1f-t));
            paint.setColor(withAlpha(accent,(int)(180*(1f-t))));
            if("CRACK".equals(p.reaction)) {
                for(int k=0;k<7;k++) {
                    float a=(float)(k/7.0*Math.PI*2.0);
                    float len=max*t*(0.7f+0.4f*(k%3));
                    canvas.drawLine(x,y,x+(float)Math.cos(a)*len,y+(float)Math.sin(a)*len,paint);
                }
            } else {
                canvas.drawCircle(x,y,max*t,paint);
            }
            paint.setStyle(Paint.Style.FILL);
        }
    }

    private static int withAlpha(int color,int alpha){
        return (color & 0x00FFFFFF) | (Math.max(0,Math.min(255,alpha))<<24);
    }
    private static int parse(String hex,int fallback){
        try{return Color.parseColor(hex);}catch(Exception ignored){return fallback;}
    }
    private static float clamp(float v,float min,float max){return Math.max(min,Math.min(max,v));}

    private static final class Node {
        float x,y,phase,speed,vx,vy;
        Node(float x,float y,float phase,float speed){this.x=x;this.y=y;this.phase=phase;this.speed=speed;}
    }
    private static final class Pulse {
        final float x,y; final long bornAt,lifeMs; final String reaction;
        Pulse(float x,float y,long bornAt,long lifeMs,String reaction){
            this.x=x;this.y=y;this.bornAt=bornAt;this.lifeMs=lifeMs;this.reaction=reaction;
        }
    }
}
