'use client';

import React, { useState, useEffect, useRef } from 'react';
import CampaignMapView from './CampaignMapView';

// Floating Embers Canvas component for authentic Rome: Total War cinematic atmosphere
function EmbersOverlay() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const embers = Array.from({ length: 42 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 0.9 + 0.35,
      speedX: (Math.random() - 0.5) * 0.6,
      opacity: Math.random() * 0.7 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width, h = canvas.height;

      for (const e of embers) {
        e.y -= e.speedY;
        e.x += e.speedX + Math.sin(e.pulse) * 0.35;
        e.pulse += 0.02;

        if (e.y < -10) {
          e.y = h + 10;
          e.x = Math.random() * w;
        }
        if (e.x < -10) e.x = w + 10;
        if (e.x > w + 10) e.x = -10;

        const alpha = e.opacity * (0.6 + 0.4 * Math.sin(e.pulse));
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius * 2.8);
        grad.addColorStop(0, `rgba(255, 200, 110, ${alpha})`);
        grad.addColorStop(0.4, `rgba(255, 90, 20, ${alpha * 0.8})`);
        grad.addColorStop(1, 'rgba(180, 20, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
}

// Sound effects synthesizer using Web Audio API (zero external assets required)
class RomanAudio {
  static playClick() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {}
  }

  static playHover() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(554, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {}
  }
}

export default function GameRoot() {
  // Navigation Modes:
  // 'main' | 'campaign_select' | 'story_campaign' | 'grand_campaign' | 'open_battle' | 'debug' | 'options'
  const [currentView, setCurrentView] = useState('main');
  const [hoveredDescription, setHoveredDescription] = useState('CHOOSE AN OPTION TO ENTER THE THEATRE OF WAR');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Selected story campaign chapter for briefing modal
  const [selectedStory, setSelectedStory] = useState(null);
  const [launchNotification, setLaunchNotification] = useState(null);

  // Grand campaign faction selection state
  const [selectedFaction, setSelectedFaction] = useState('spqr');
  const [campaignEra, setCampaignEra] = useState('218 BC');

  // Open battle setup state
  const [battleType, setBattleType] = useState('pitched');
  const [battleLocation, setBattleLocation] = useState('cannae');
  const [playerCohort, setPlayerCohort] = useState('Legio Gemina');

  const triggerSound = (type) => {
    if (!soundEnabled) return;
    if (type === 'click') RomanAudio.playClick();
    if (type === 'hover') RomanAudio.playHover();
  };

  const showLaunchTeaser = (title, msg) => {
    triggerSound('click');
    setLaunchNotification({ title, msg });
  };

  // If debug mode is active, render our full interactive 400-site tactical campaign map
  if (currentView === 'debug') {
    return <CampaignMapView onExitToMenu={() => setCurrentView('main')} />;
  }

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: '#070607',
      userSelect: 'none',
      fontFamily: "'Cinzel', Georgia, serif",
    }}>
      {/* ── Background Backdrop Layer ────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: currentView === 'grand_campaign'
          ? "url('/images/grand_campaign.jpg')"
          : currentView === 'story_campaign'
            ? (selectedStory === 'caesar'
                ? "url('/images/caesar_journey.jpg')"
                : selectedStory === 'nightmare'
                  ? "url('/images/hannibal_punic_war.jpg')"
                  : "url('/images/rise_of_emperor.jpg')")
            : "url('/images/main_menu_bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: currentView === 'main' ? 'brightness(0.92) contrast(1.08)' : 'brightness(0.55) contrast(1.15) blur(1px)',
        transition: 'all 0.6s ease',
        transform: 'scale(1.02)',
      }} />

      {/* Dark Vignette / Red Cinematic Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: currentView === 'main'
          ? 'radial-gradient(ellipse at 50% 48%, rgba(80, 0, 0, 0.15) 0%, rgba(15, 2, 2, 0.72) 70%, rgba(5, 0, 0, 0.95) 100%)'
          : 'rgba(7, 4, 3, 0.82)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      {/* Burning Embers Particle System */}
      <EmbersOverlay />

      {/* Top Bar Quick Controls */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 26,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => {
            setSoundEnabled(!soundEnabled);
            triggerSound('click');
          }}
          style={{
            background: 'rgba(20, 14, 10, 0.8)',
            border: '1px solid #73512a',
            borderRadius: 6,
            color: soundEnabled ? '#ffe18f' : '#888',
            padding: '7px 12px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '1px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
          }}
          title="Toggle Roman Audio Effects"
        >
          {soundEnabled ? '🔊 AUDIO: ON' : '🔇 AUDIO: MUTED'}
        </button>

        {currentView !== 'main' && (
          <button
            onClick={() => {
              triggerSound('click');
              setCurrentView('main');
            }}
            style={{
              background: 'linear-gradient(180deg, #442a12 0%, #1e1106 100%)',
              border: '1px solid #d4a34b',
              borderRadius: 6,
              color: '#ffffff',
              padding: '7px 16px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '1.2px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
            }}
            onMouseOver={() => triggerSound('hover')}
          >
            ◀ RETURN TO MENU
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SCREEN 1: MAIN MENU (Classic Rome: Total War Centered Red Wheel Layout)
          ════════════════════════════════════════════════════════════════════════ */}
      {currentView === 'main' && (
        <div style={{
          position: 'relative',
          zIndex: 20,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Monumental Roman Logo Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 4,
            }}>
              <span style={{ fontSize: '24px', color: '#d4a34b', filter: 'drop-shadow(0 0 10px #d4a34b)' }}>🦅</span>
              <span style={{
                fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
                fontSize: '14px',
                fontWeight: 900,
                letterSpacing: '6px',
                color: '#d4a34b',
                textTransform: 'uppercase',
                textShadow: '0 2px 8px #000',
              }}>
                SENATUS POPULUSQUE ROMANUS
              </span>
              <span style={{ fontSize: '24px', color: '#d4a34b', filter: 'drop-shadow(0 0 10px #d4a34b)' }}>🦅</span>
            </div>

            {/* Main Game Title: Skull and Swords: Battle for Rome */}
            <h1 className="roman-title-gold" style={{
              fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
              fontSize: '54px',
              fontWeight: 900,
              letterSpacing: '4px',
              lineHeight: 1.1,
              marginBottom: 6,
            }}>
              SKULL & SWORDS
            </h1>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}>
              <div style={{ height: '1px', width: 90, background: 'linear-gradient(90deg, transparent, #d4a34b)' }} />
              <h2 className="roman-title-red" style={{
                fontFamily: "'Cinzel', serif",
                fontSize: '24px',
                fontWeight: 800,
                letterSpacing: '7px',
                textTransform: 'uppercase',
              }}>
                BATTLE FOR ROME
              </h2>
              <div style={{ height: '1px', width: 90, background: 'linear-gradient(270deg, transparent, #d4a34b)' }} />
            </div>
          </div>

          {/* Rome Total War Centered Circular Menu Disk */}
          <div style={{
            position: 'relative',
            width: 440,
            height: 440,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 2, 2, 0.88) 0%, rgba(26, 4, 4, 0.82) 48%, rgba(5, 0, 0, 0.94) 80%, transparent 100%)',
            boxShadow: 'inset 0 0 50px rgba(0,0,0,0.9), 0 0 60px rgba(100, 10, 10, 0.45)',
            border: '1px solid rgba(180, 100, 40, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            backdropFilter: 'blur(4px)',
          }}>
            {/* Roman Laurel Rim Accent */}
            <div style={{
              position: 'absolute',
              inset: 8,
              borderRadius: '50%',
              border: '1px dashed rgba(212, 163, 75, 0.25)',
              pointerEvents: 'none',
            }} />

            {/* Menu Items */}
            <button
              className="menu-btn"
              style={{ fontSize: '20px', fontWeight: 800 }}
              onClick={() => {
                triggerSound('click');
                setCurrentView('campaign_select');
              }}
              onMouseEnter={() => {
                triggerSound('hover');
                setHoveredDescription('ENTER THE STRATEGIC CAMPAIGN: STORY SCENARIOS OR GRAND MEDITERRANEAN CONQUEST');
              }}
            >
              CAMPAIGN
            </button>

            <button
              className="menu-btn"
              style={{ fontSize: '18px', fontWeight: 700 }}
              onClick={() => {
                triggerSound('click');
                setCurrentView('open_battle');
              }}
              onMouseEnter={() => {
                triggerSound('hover');
                setHoveredDescription('CUSTOM FIELD BATTLES, OPPIDUM SIEGES, AND TACTICAL ARMY CLASHES');
              }}
            >
              OPEN BATTLE
            </button>

            <button
              className="menu-btn"
              style={{ fontSize: '18px', fontWeight: 700, color: '#ffe18f' }}
              onClick={() => {
                triggerSound('click');
                setCurrentView('debug');
              }}
              onMouseEnter={() => {
                triggerSound('hover');
                setHoveredDescription('DEBUG SANDBOX: 400 ANCIENT SITES, FRACTAL WATERSHED PROVINCES & TERRAIN DEM');
              }}
            >
              🛠️ DEBUG MODE
            </button>

            <button
              className="menu-btn"
              style={{ fontSize: '16px', fontWeight: 700, color: '#c4b094' }}
              onClick={() => {
                triggerSound('click');
                setCurrentView('options');
              }}
              onMouseEnter={() => {
                triggerSound('hover');
                setHoveredDescription('CONFIGURE GRAPHICAL FIDELITY, AUDIO BALANCE, AND TACTICAL CONTROLS');
              }}
            >
              OPTIONS
            </button>

            <button
              className="menu-btn"
              style={{ fontSize: '16px', fontWeight: 700, color: '#a08874' }}
              onClick={() => {
                triggerSound('click');
                showLaunchTeaser('Exit Game', 'To exit the campaign, close your browser tab.');
              }}
              onMouseEnter={() => {
                triggerSound('hover');
                setHoveredDescription('QUIT THE APPLICATION AND RETURN TO DESKTOP');
              }}
            >
              QUIT
            </button>
          </div>

          {/* Bottom Total War Style Status Ticker */}
          <div style={{
            position: 'absolute',
            bottom: 30,
            textAlign: 'center',
            fontSize: '12px',
            color: '#d4a34b',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontWeight: 700,
            textShadow: '0 2px 6px #000',
            maxWidth: 800,
          }}>
            {hoveredDescription}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SCREEN 2: CAMPAIGN SELECTION (Story vs Grand Campaign)
          ════════════════════════════════════════════════════════════════════════ */}
      {currentView === 'campaign_select' && (
        <div style={{
          position: 'relative',
          zIndex: 20,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 40px',
        }}>
          <h2 className="roman-title-gold" style={{
            fontSize: '36px',
            fontWeight: 900,
            letterSpacing: '3px',
            marginBottom: 10,
            textAlign: 'center',
          }}>
            SELECT CAMPAIGN TYPE
          </h2>
          <div style={{ fontSize: '13px', color: '#c4ad8e', letterSpacing: '1px', marginBottom: 40, textAlign: 'center' }}>
            Choose whether to guide history through bespoke narrative chapters or dominate the ancient world in total sandbox conquest
          </div>

          <div style={{ display: 'flex', gap: 36, maxWidth: 960, width: '100%' }}>
            {/* Story Campaign Card */}
            <div
              onClick={() => {
                triggerSound('click');
                setCurrentView('story_campaign');
              }}
              onMouseEnter={() => triggerSound('hover')}
              style={{
                flex: 1,
                background: 'linear-gradient(180deg, rgba(30, 20, 14, 0.92) 0%, rgba(12, 8, 6, 0.95) 100%)',
                border: '2px solid #8e6c38',
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.85)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.borderColor = '#ffd700';
                e.currentTarget.style.boxShadow = '0 18px 50px rgba(255, 215, 0, 0.25)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#8e6c38';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.85)';
              }}
            >
              <div style={{
                height: 220,
                backgroundImage: "url('/images/caesar_journey.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderBottom: '2px solid #8e6c38',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(0deg, rgba(12,8,6,0.95) 0%, transparent 60%)',
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: 14,
                  left: 20,
                  fontSize: '22px',
                  fontWeight: 900,
                  color: '#ffffff',
                  textShadow: '0 2px 10px #000',
                  letterSpacing: '1.5px',
                }}>
                  📜 STORY CAMPAIGN
                </div>
              </div>

              <div style={{ padding: '24px 20px' }}>
                <div style={{ fontSize: '13px', color: '#eeddbb', lineHeight: 1.6, marginBottom: 18 }}>
                  Relive pivotal epochs that forged Roman destiny. Take command of legendary generals across curated historical chapters with bespoke battlefield events, dilemmas, and triumph milestones.
                </div>

                <div style={{ borderTop: '1px solid #4a341e', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12px', color: '#c4ad8e' }}>
                  <div>⚔️ <b>The Rise of The Emperor</b> (Augustus & Pax Romana)</div>
                  <div>⚔️ <b>Caesar's Journey</b> (Gallic Wars & The Rubicon)</div>
                  <div>⚔️ <b>Rome's Nightmare</b> (Hannibal Barca & The 2nd Punic War)</div>
                </div>

                <button style={{
                  width: '100%',
                  marginTop: 24,
                  padding: '12px 0',
                  background: 'linear-gradient(180deg, #604018 0%, #2f1d09 100%)',
                  border: '1px solid #d4a34b',
                  borderRadius: 6,
                  color: '#ffe18f',
                  fontSize: '13px',
                  fontWeight: 900,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                }}>
                  ENTER STORY CHAPTERS
                </button>
              </div>
            </div>

            {/* Grand Campaign Card */}
            <div
              onClick={() => {
                triggerSound('click');
                setCurrentView('grand_campaign');
              }}
              onMouseEnter={() => triggerSound('hover')}
              style={{
                flex: 1,
                background: 'linear-gradient(180deg, rgba(30, 20, 14, 0.92) 0%, rgba(12, 8, 6, 0.95) 100%)',
                border: '2px solid #8e6c38',
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.85)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.borderColor = '#ffd700';
                e.currentTarget.style.boxShadow = '0 18px 50px rgba(255, 215, 0, 0.25)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#8e6c38';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.85)';
              }}
            >
              <div style={{
                height: 220,
                backgroundImage: "url('/images/grand_campaign.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderBottom: '2px solid #8e6c38',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(0deg, rgba(12,8,6,0.95) 0%, transparent 60%)',
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: 14,
                  left: 20,
                  fontSize: '22px',
                  fontWeight: 900,
                  color: '#ffffff',
                  textShadow: '0 2px 10px #000',
                  letterSpacing: '1.5px',
                }}>
                  🏛️ GRAND CAMPAIGN
                </div>
              </div>

              <div style={{ padding: '24px 20px' }}>
                <div style={{ fontSize: '13px', color: '#eeddbb', lineHeight: 1.6, marginBottom: 18 }}>
                  Total Mediterranean sandbox conquest. Guide your faction across 400 ancient settlements and provinces, manage taxation, forge legions, conduct diplomacy, and conquer the civilized world.
                </div>

                <div style={{ borderTop: '1px solid #4a341e', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12px', color: '#c4ad8e' }}>
                  <div>🏛️ <b>400 Historical Settlements & Regions</b></div>
                  <div>🏛️ <b>Multiple Playable Empires & Tribal Polities</b></div>
                  <div>🏛️ <b>Dynamic Watershed Frontiers & Elevation DEM</b></div>
                </div>

                <button style={{
                  width: '100%',
                  marginTop: 24,
                  padding: '12px 0',
                  background: 'linear-gradient(180deg, #604018 0%, #2f1d09 100%)',
                  border: '1px solid #d4a34b',
                  borderRadius: 6,
                  color: '#ffe18f',
                  fontSize: '13px',
                  fontWeight: 900,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                }}>
                  LAUNCH GRAND CAMPAIGN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SCREEN 3: STORY CAMPAIGN CHAPTERS (The 3 Historical Sagas)
          ════════════════════════════════════════════════════════════════════════ */}
      {currentView === 'story_campaign' && (
        <div style={{
          position: 'relative',
          zIndex: 20,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 40px',
        }}>
          <h2 className="roman-title-gold" style={{
            fontSize: '34px',
            fontWeight: 900,
            letterSpacing: '3px',
            marginBottom: 6,
            textAlign: 'center',
          }}>
            HISTORICAL STORY CAMPAIGNS
          </h2>
          <div style={{ fontSize: '12px', color: '#c4ad8e', letterSpacing: '1px', marginBottom: 28, textAlign: 'center' }}>
            Choose an epic saga to relive Rome's most defining conflicts and triumphs
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
            maxWidth: 1260,
            width: '100%',
          }}>
            {/* Story 1: The Rise of The Emperor */}
            <div
              onClick={() => setSelectedStory('emperor')}
              onMouseEnter={() => triggerSound('hover')}
              style={{
                background: 'linear-gradient(180deg, rgba(28, 18, 12, 0.94) 0%, rgba(14, 9, 6, 0.96) 100%)',
                border: selectedStory === 'emperor' ? '2px solid #ffd700' : '2px solid #6b4d24',
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: selectedStory === 'emperor' ? '0 0 30px rgba(255, 215, 0, 0.3)' : '0 8px 30px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{
                height: 180,
                backgroundImage: "url('/images/rise_of_emperor.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                borderBottom: '1px solid #73512a',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  background: 'rgba(0,0,0,0.75)',
                  border: '1px solid #d4a34b',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: '10px',
                  color: '#ffe18f',
                  fontWeight: 800,
                }}>
                  27 BC – 14 AD
                </div>
              </div>

              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: '10px', color: '#d4a34b', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 4 }}>
                  Chapter I • Pax Romana
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', marginBottom: 8, letterSpacing: '0.8px' }}>
                  The Rise of The Emperor
                </div>
                <div style={{ fontSize: '12px', color: '#c4ad8e', lineHeight: 1.5, marginBottom: 14 }}>
                  From the ruins of the shattered Republic, guide young Octavian Augustus to outmaneuver the Senate, establish the Praetorian Guard, subdue the Cantabrian highlands, and cement imperial rule.
                </div>

                <div style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid #3d2a14',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: '11px',
                  color: '#eeddbb',
                  marginBottom: 14,
                }}>
                  <div style={{ color: '#d4a34b', fontWeight: 800, marginBottom: 2 }}>Main Objective:</div>
                  <div>Secure 40 provinces, quell the Illyrian revolt, and transform Rome into a city of marble.</div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    showLaunchTeaser('The Rise of The Emperor', 'Chapter Briefing: Octavian has been acclaimed Augustus by the Senate. Prepare to pacify the Danube frontier.');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    background: 'linear-gradient(180deg, #5c3b17 0%, #281708 100%)',
                    border: '1px solid #d4a34b',
                    borderRadius: 4,
                    color: '#ffe18f',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: "'Cinzel', serif",
                  }}
                >
                  START CHAPTER
                </button>
              </div>
            </div>

            {/* Story 2: Caesar's Journey */}
            <div
              onClick={() => setSelectedStory('caesar')}
              onMouseEnter={() => triggerSound('hover')}
              style={{
                background: 'linear-gradient(180deg, rgba(28, 18, 12, 0.94) 0%, rgba(14, 9, 6, 0.96) 100%)',
                border: selectedStory === 'caesar' ? '2px solid #ffd700' : '2px solid #6b4d24',
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: selectedStory === 'caesar' ? '0 0 30px rgba(255, 215, 0, 0.3)' : '0 8px 30px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{
                height: 180,
                backgroundImage: "url('/images/caesar_journey.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                borderBottom: '1px solid #73512a',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  background: 'rgba(0,0,0,0.75)',
                  border: '1px solid #d4a34b',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: '10px',
                  color: '#ffe18f',
                  fontWeight: 800,
                }}>
                  58 BC – 44 BC
                </div>
              </div>

              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: '10px', color: '#d4a34b', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 4 }}>
                  Chapter II • The Gallic Wars & Civil War
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', marginBottom: 8, letterSpacing: '0.8px' }}>
                  Caesar's Journey
                </div>
                <div style={{ fontSize: '12px', color: '#c4ad8e', lineHeight: 1.5, marginBottom: 14 }}>
                  Take command of Legio XIII Gemina. Besiege Vercingetorix's fortress at Alesia, invade mysterious Britannia, and cross the Rubicon into Italy to challenge Pompey the Great and the Optimates.
                </div>

                <div style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid #3d2a14',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: '11px',
                  color: '#eeddbb',
                  marginBottom: 14,
                }}>
                  <div style={{ color: '#d4a34b', fontWeight: 800, marginBottom: 2 }}>Main Objective:</div>
                  <div>Conquer the 300 Gallic oppida, cross the Rubicon, and seize Dictatorship in Rome.</div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    showLaunchTeaser("Caesar's Journey", "Alea iacta est! The die is cast. Legio XIII Gemina marches towards Ariminum.");
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    background: 'linear-gradient(180deg, #5c3b17 0%, #281708 100%)',
                    border: '1px solid #d4a34b',
                    borderRadius: 4,
                    color: '#ffe18f',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: "'Cinzel', serif",
                  }}
                >
                  START CHAPTER
                </button>
              </div>
            </div>

            {/* Story 3: Rome's Nightmare (Punic War 2) */}
            <div
              onClick={() => setSelectedStory('nightmare')}
              onMouseEnter={() => triggerSound('hover')}
              style={{
                background: 'linear-gradient(180deg, rgba(28, 18, 12, 0.94) 0%, rgba(14, 9, 6, 0.96) 100%)',
                border: selectedStory === 'nightmare' ? '2px solid #ffd700' : '2px solid #6b4d24',
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: selectedStory === 'nightmare' ? '0 0 30px rgba(255, 215, 0, 0.3)' : '0 8px 30px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{
                height: 180,
                backgroundImage: "url('/images/hannibal_punic_war.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                borderBottom: '1px solid #73512a',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  background: 'rgba(0,0,0,0.75)',
                  border: '1px solid #d4a34b',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: '10px',
                  color: '#ffe18f',
                  fontWeight: 800,
                }}>
                  218 BC – 201 BC
                </div>
              </div>

              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: '10px', color: '#ff6b6b', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 4 }}>
                  Chapter III • The Second Punic War
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', marginBottom: 8, letterSpacing: '0.8px' }}>
                  Rome's Nightmare
                </div>
                <div style={{ fontSize: '12px', color: '#c4ad8e', lineHeight: 1.5, marginBottom: 14 }}>
                  Hannibal Barca has marched war elephants through the frozen Alps, wiping out legions at Trebia, Lake Trasimene, and Cannae. Can Rome withstand total extinction, or will Scipio strike Carthage directly?
                </div>

                <div style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid #3d2a14',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: '11px',
                  color: '#eeddbb',
                  marginBottom: 14,
                }}>
                  <div style={{ color: '#d4a34b', fontWeight: 800, marginBottom: 2 }}>Main Objective:</div>
                  <div>Survive Hannibal's rampage, defend Rome's Italian allies, and defeat Carthage at Zama.</div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    showLaunchTeaser("Rome's Nightmare", "Hannibal ad portas! The Carthaginian host descends the Alps into the Po Valley.");
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    background: 'linear-gradient(180deg, #5c3b17 0%, #281708 100%)',
                    border: '1px solid #d4a34b',
                    borderRadius: 4,
                    color: '#ffe18f',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: "'Cinzel', serif",
                  }}
                >
                  START CHAPTER
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SCREEN 4: GRAND CAMPAIGN SETUP (Faction Selection & Parameters)
          ════════════════════════════════════════════════════════════════════════ */}
      {currentView === 'grand_campaign' && (
        <div style={{
          position: 'relative',
          zIndex: 20,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 40px',
        }}>
          <h2 className="roman-title-gold" style={{
            fontSize: '34px',
            fontWeight: 900,
            letterSpacing: '3px',
            marginBottom: 6,
            textAlign: 'center',
          }}>
            GRAND STRATEGY THEATRE
          </h2>
          <div style={{ fontSize: '12px', color: '#c4ad8e', letterSpacing: '1px', marginBottom: 24, textAlign: 'center' }}>
            Select your faction and era to embark on full sandbox domination across 400 ancient settlements
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 340px',
            gap: 24,
            maxWidth: 1100,
            width: '100%',
            background: 'rgba(16, 11, 8, 0.92)',
            border: '2px solid #8e6c38',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 16px 50px rgba(0,0,0,0.9)',
          }}>
            {/* Left: Faction Grid */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffe18f', letterSpacing: '1px', marginBottom: 14 }}>
                SELECT PLAYABLE FACTION
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { id: 'spqr', name: 'Roman Republic', culture: 'Italic / Latin', perk: 'Heavy Legionary Infantry & Disciplined Cohorts', color: '#a01a1a' },
                  { id: 'carthage', name: 'Carthaginian Empire', culture: 'Punic', perk: 'War Elephants & Maritime Mercenary Fleets', color: '#1a5fa8' },
                  { id: 'macedon', name: 'Macedonian League', culture: 'Hellenistic', perk: 'Sarissa Phalanx & Companion Heavy Cavalry', color: '#2a7848' },
                  { id: 'arverni', name: 'Gallic Confederation', culture: 'Celtic / Gaul', perk: 'Fierce Noble Swordsmen & Forest Ambushers', color: '#684018' },
                  { id: 'seleucid', name: 'Seleucid Empire', culture: 'Syro-Greek', perk: 'Armored Cataphracts & Royal Pikemen', color: '#8838a8' },
                  { id: 'ptolemaic', name: 'Ptolemaic Egypt', culture: 'Egyptian / Greek', perk: 'Nile Trade Hegemony & Royal Guard Infantry', color: '#c49018' },
                ].map(f => (
                  <div
                    key={f.id}
                    onClick={() => {
                      setSelectedFaction(f.id);
                      triggerSound('click');
                    }}
                    onMouseEnter={() => triggerSound('hover')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 6,
                      background: selectedFaction === f.id ? 'rgba(70, 40, 15, 0.85)' : 'rgba(25, 18, 12, 0.7)',
                      border: selectedFaction === f.id ? '2px solid #ffd700' : '1px solid #5a3d1e',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 900, color: selectedFaction === f.id ? '#ffffff' : '#e8d4b8', marginBottom: 4 }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#d4a34b', marginBottom: 6 }}>
                      {f.culture}
                    </div>
                    <div style={{ fontSize: '10px', color: '#b8a284', lineHeight: 1.4 }}>
                      {f.perk}
                    </div>
                  </div>
                ))}
              </div>

              {/* Era Selector */}
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#ffe18f', letterSpacing: '1px', marginBottom: 10 }}>
                CAMPAIGN STARTING ERA
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { id: '270 BC', label: '270 BC (Rise of Republic)' },
                  { id: '218 BC', label: '218 BC (Punic Wars)' },
                  { id: '58 BC', label: '58 BC (Caesar in Gaul)' },
                ].map(era => (
                  <button
                    key={era.id}
                    onClick={() => {
                      setCampaignEra(era.id);
                      triggerSound('click');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 4,
                      background: campaignEra === era.id ? '#55391c' : '#22160d',
                      border: campaignEra === era.id ? '1px solid #ffd700' : '1px solid #4a331c',
                      color: campaignEra === era.id ? '#ffffff' : '#a8947a',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: "'Cinzel', serif",
                    }}
                  >
                    {era.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Campaign Briefing Panel */}
            <div style={{
              background: 'rgba(24, 16, 10, 0.95)',
              border: '1px solid #73512a',
              borderRadius: 8,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#d4a34b', letterSpacing: '1px', fontWeight: 800, marginBottom: 4 }}>
                  FACTION OVERVIEW
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', marginBottom: 12 }}>
                  {selectedFaction === 'spqr' ? 'Senatus Populusque Romanus' : selectedFaction.toUpperCase()}
                </div>
                <div style={{ fontSize: '11px', color: '#c4ad8e', lineHeight: 1.6, marginBottom: 16 }}>
                  {selectedFaction === 'spqr' && 'Rome commands disciplined maniples and the wealthiest Italian provinces. Expanding beyond the Alps requires subjugating warlike Celtic tribes while keeping watchful eyes on Carthage.'}
                  {selectedFaction === 'carthage' && 'Masters of maritime commerce and formidable African war elephants. You dominate western Sicily, Sardinia, and Iberia, but your mercenary armies demand vast silver treasury.'}
                  {selectedFaction === 'macedon' && 'The phalanxes of Philip and Alexander remain a devastating anvil in open terrain. Defend Hellenic supremacy against barbarians and ambitious Roman legions.'}
                  {selectedFaction === 'arverni' && 'The fierce warlords of Gaul unite to defend their sacred oppida. Harness dense forest ambushes and massive cavalry charges to break imperial invaders.'}
                  {selectedFaction === 'seleucid' && 'The vast Syrian empire stretching to Mesopotamia. Boasts armored cataphracts and war elephants, but faces rebellion on multiple fronts.'}
                  {selectedFaction === 'ptolemaic' && 'The legendary wealth of Alexandria and the Nile grain trade. Maintain naval control over the eastern Mediterranean with majestic quinqueremes.'}
                </div>

                <div style={{
                  borderTop: '1px solid #4a341e',
                  paddingTop: 12,
                  fontSize: '11px',
                  color: '#a0886c',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  <div><b>Total Territories:</b> 400 Regions</div>
                  <div><b>Frontier Engine:</b> Fractal Watershed Cost-Distance</div>
                  <div><b>Difficulty:</b> Regular</div>
                </div>
              </div>

              <button
                onClick={() => showLaunchTeaser('Grand Campaign Launch', `Commencing Grand Conquest as ${selectedFaction.toUpperCase()} in ${campaignEra}. Assembling tactical theatre across 400 provinces.`)}
                style={{
                  width: '100%',
                  marginTop: 18,
                  padding: '12px 0',
                  background: 'linear-gradient(180deg, #6b451c 0%, #2f1b09 100%)',
                  border: '1px solid #ffd700',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 900,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                  boxShadow: '0 4px 15px rgba(255, 215, 0, 0.2)',
                }}
              >
                ⚔️ LAUNCH GRAND CONQUEST
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SCREEN 5: OPEN BATTLE MODE (Tactical Clashes & Skirmish Simulator)
          ════════════════════════════════════════════════════════════════════════ */}
      {currentView === 'open_battle' && (
        <div style={{
          position: 'relative',
          zIndex: 20,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 40px',
        }}>
          <h2 className="roman-title-gold" style={{
            fontSize: '34px',
            fontWeight: 900,
            letterSpacing: '3px',
            marginBottom: 6,
            textAlign: 'center',
          }}>
            OPEN BATTLE THEATRE
          </h2>
          <div style={{ fontSize: '12px', color: '#c4ad8e', letterSpacing: '1px', marginBottom: 24, textAlign: 'center' }}>
            Customize opposing battle lines, select battlefield geography, and orchestrate tactical clashes
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            maxWidth: 1100,
            width: '100%',
          }}>
            {/* Panel 1: Battle Scenario & Terrain */}
            <div style={{
              background: 'rgba(20, 14, 10, 0.94)',
              border: '1px solid #73512a',
              borderRadius: 8,
              padding: 20,
            }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffe18f', letterSpacing: '1px', marginBottom: 14 }}>
                1. BATTLE ENGAGEMENT TYPE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {[
                  { id: 'pitched', name: 'Open Field Pitched Battle', desc: 'Symmetrical battlefield with cavalry flanking room' },
                  { id: 'siege', name: 'Oppidum Assault / Siege', desc: 'Assault fortified hillfort walls with battering rams' },
                  { id: 'river', name: 'River Crossing Defense', desc: 'Defend narrow shallow fords against oncoming cohorts' },
                  { id: 'ambush', name: 'Forest Ambush in the Mist', desc: 'Sudden flank assault on marching column' },
                ].map(b => (
                  <div
                    key={b.id}
                    onClick={() => { setBattleType(b.id); triggerSound('click'); }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: battleType === b.id ? 'rgba(80, 45, 18, 0.8)' : 'rgba(28, 18, 12, 0.7)',
                      border: battleType === b.id ? '1px solid #ffd700' : '1px solid #4a341e',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 800, color: battleType === b.id ? '#ffffff' : '#d4bfa6' }}>
                      {b.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#9e8a72' }}>{b.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffe18f', letterSpacing: '1px', marginBottom: 10 }}>
                BATTLEFIELD LOCATION
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { id: 'cannae', name: 'Plains of Cannae' },
                  { id: 'alesia', name: 'Alesia Valley' },
                  { id: 'teutoburg', name: 'Teutoburg Forest' },
                  { id: 'zama', name: 'Zama Desert' },
                ].map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => { setBattleLocation(loc.id); triggerSound('click'); }}
                    style={{
                      padding: '8px 6px',
                      background: battleLocation === loc.id ? '#523419' : '#1c120a',
                      border: battleLocation === loc.id ? '1px solid #ffd700' : '1px solid #3d2814',
                      color: battleLocation === loc.id ? '#ffffff' : '#a8947c',
                      borderRadius: 4,
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: "'Cinzel', serif",
                    }}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel 2: Player Army Cohorts */}
            <div style={{
              background: 'rgba(20, 14, 10, 0.94)',
              border: '1px solid #73512a',
              borderRadius: 8,
              padding: 20,
            }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffe18f', letterSpacing: '1px', marginBottom: 14 }}>
                2. PLAYER ARMY ROSTER
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {[
                  { name: '4x Veteran Roman Legionaries', count: '480 men', type: 'Heavy Infantry' },
                  { name: '2x Triarii Spear Cohorts', count: '240 men', type: 'Elite Anti-Cavalry' },
                  { name: '2x Equites Cavalry Wings', count: '120 riders', type: 'Flanking Shock Cavalry' },
                  { name: '2x Cretan Archer Auxilia', count: '160 bowmen', type: 'Missile Support' },
                  { name: '1x Roman Ballista Battery', count: '2 engines', type: 'Siege Artillery' },
                ].map((unit, i) => (
                  <div key={i} style={{
                    padding: '8px 10px',
                    borderRadius: 4,
                    background: 'rgba(28, 18, 12, 0.8)',
                    border: '1px solid #4a341e',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#f5e8d4' }}>{unit.name}</div>
                      <div style={{ fontSize: '9px', color: '#9e8a72' }}>{unit.type}</div>
                    </div>
                    <div style={{ fontSize: '10px', color: '#ffe18f', fontWeight: 700 }}>{unit.count}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#d4a34b', fontWeight: 700, textAlign: 'right' }}>
                Total Strength: 1,000 Warriors
              </div>
            </div>

            {/* Panel 3: Opposing Army & Launch */}
            <div style={{
              background: 'rgba(20, 14, 10, 0.94)',
              border: '1px solid #73512a',
              borderRadius: 8,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#ff7777', letterSpacing: '1px', marginBottom: 14 }}>
                  3. OPPOSING HOST (ENEMY)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {[
                    { name: '5x Fierce Gallic Noble Warbands', count: '600 warriors', type: 'Shock Infantry' },
                    { name: '2x Heavy Celtic Cavalry', count: '140 horsemen', type: 'Shock Flankers' },
                    { name: '3x Slingers of the Balearics', count: '240 skirmishers', type: 'Armor Piercing' },
                    { name: '1x Chieftain Bodyguard Cohort', count: '80 elite nobles', type: 'Commander Retinue' },
                  ].map((unit, i) => (
                    <div key={i} style={{
                      padding: '8px 10px',
                      borderRadius: 4,
                      background: 'rgba(28, 12, 12, 0.8)',
                      border: '1px solid #5a2828',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#f5d4d4' }}>{unit.name}</div>
                        <div style={{ fontSize: '9px', color: '#a07878' }}>{unit.type}</div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#ff9999', fontWeight: 700 }}>{unit.count}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#ff7777', fontWeight: 700, textAlign: 'right' }}>
                  Total Enemy Strength: 1,060 Warriors
                </div>
              </div>

              <button
                onClick={() => showLaunchTeaser('Open Battle Deployment', `Deploying 1,000 Roman legionnaires against 1,060 Gallic warriors at ${battleLocation.toUpperCase()}. Battle engines standing by.`)}
                style={{
                  width: '100%',
                  marginTop: 18,
                  padding: '12px 0',
                  background: 'linear-gradient(180deg, #782020 0%, #360c0c 100%)',
                  border: '1px solid #ff7777',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 900,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                  boxShadow: '0 4px 15px rgba(255, 60, 60, 0.3)',
                }}
              >
                ⚔️ COMMENCE BATTLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SCREEN 6: OPTIONS MODAL (Audio, Graphics, Interface)
          ════════════════════════════════════════════════════════════════════════ */}
      {currentView === 'options' && (
        <div style={{
          position: 'relative',
          zIndex: 20,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(20, 14, 10, 0.96)',
            border: '2px solid #8e6c38',
            borderRadius: 12,
            padding: '28px 36px',
            maxWidth: 580,
            width: '90%',
            boxShadow: '0 16px 50px rgba(0,0,0,0.95)',
          }}>
            <h2 className="roman-title-gold" style={{
              fontSize: '26px',
              fontWeight: 900,
              letterSpacing: '2px',
              marginBottom: 18,
              textAlign: 'center',
            }}>
              GAME OPTIONS
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 26, fontSize: '13px', color: '#c4ad8e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Sound Effects (Synthesizer):</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 4,
                    background: soundEnabled ? '#55391c' : '#22160d',
                    border: '1px solid #d4a34b',
                    color: soundEnabled ? '#ffe18f' : '#888',
                    cursor: 'pointer',
                    fontFamily: "'Cinzel', serif",
                  }}
                >
                  {soundEnabled ? 'ENABLED' : 'MUTED'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Vector Border Precision:</span>
                <span style={{ color: '#ffe18f', fontWeight: 700 }}>Fractal Non-Scaling White</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Settlements Database:</span>
                <span style={{ color: '#ffe18f', fontWeight: 700 }}>400 Sites (1:10m Elevation)</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Frontier Engine:</span>
                <span style={{ color: '#ffe18f', fontWeight: 700 }}>Cost-Weighted Distance</span>
              </div>
            </div>

            <button
              onClick={() => { triggerSound('click'); setCurrentView('main'); }}
              style={{
                width: '100%',
                padding: '10px 0',
                background: 'linear-gradient(180deg, #442a12 0%, #1e1106 100%)',
                border: '1px solid #d4a34b',
                borderRadius: 6,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '1px',
                cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
              }}
            >
              SAVE & RETURN
            </button>
          </div>
        </div>
      )}

      {/* ── Briefing / Action Teaser Modal ───────────────────────────────────── */}
      {launchNotification && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #1f140c 0%, #100a06 100%)',
            border: '2px solid #d4a34b',
            borderRadius: 12,
            padding: '24px 30px',
            maxWidth: 480,
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.95)',
          }}>
            <div style={{ fontSize: '32px', marginBottom: 10 }}>⚔️</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffe18f', letterSpacing: '1px', marginBottom: 10 }}>
              {launchNotification.title}
            </div>
            <div style={{ fontSize: '13px', color: '#c4ad8e', lineHeight: 1.6, marginBottom: 24 }}>
              {launchNotification.msg}
            </div>
            <button
              onClick={() => setLaunchNotification(null)}
              style={{
                padding: '8px 26px',
                background: 'linear-gradient(180deg, #5c3b17 0%, #281708 100%)',
                border: '1px solid #d4a34b',
                borderRadius: 4,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '1px',
                cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
              }}
            >
              ACKNOWLEDGE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
