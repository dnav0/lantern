import React, { useState } from 'react'
import Wordmark from '../Wordmark'
import SignIn from '../SignIn'
import HeroFlythrough from './HeroFlythrough'
import FeatureClips from './FeatureClips'
import '../../assets/landing.css'

// The public landing page — what an unauthenticated visitor sees. Root's
// signedOut phase used to render a bare SignIn screen with no explanation of
// what the app is; this is that explanation, with sign-in behind a CTA.
//
// Ported from the approved specs in design/ (see design/README.md):
//   - design/lantern-mockup.html   — layout, copy, login direction
//   - design/lantern-hero.html     — the hero animation
//   - design/lantern-features.html — the three feature clips
//
// Deliberate deviations from lantern-mockup.html, which predates two later
// decisions (both noted in BACKLOG):
//   - It draws the retired book+beacon pictorial mark in the nav, footer, and
//     login card. The identity is wordmark-only, so those are <Wordmark />.
//   - Its hero is a static annotated card with its own small CSS animation,
//     superseded by lantern-hero.html's approved flythrough.
//   - Its static "Four lenses" and "Read. Note. Return." sections are replaced
//     by the three feature clips, one of which is Four lenses (owner's call —
//     newest spec wins, no duplicated section).

export default function Landing(): React.JSX.Element {
  const [showLogin, setShowLogin] = useState(false)
  const openLogin = (): void => setShowLogin(true)

  return (
    <div className="landing">
      <nav className="ll-nav">
        <div className="ll-wrap ll-nav-inner">
          <Wordmark size={22} />
          <div className="ll-nav-links">
            <a href="#lenses">Four lenses</a>
            <a href="#study">In the study</a>
            <a href="#find">Find and return</a>
          </div>
          <div className="ll-nav-right">
            <button className="ll-nav-signin" type="button" onClick={openLogin}>
              Sign in
            </button>
            <button className="ll-btn ll-btn-primary" type="button" onClick={openLogin}>
              Get started
            </button>
          </div>
        </div>
      </nav>

      <section className="ll-hero-sec">
        <div className="ll-wrap">
          <div className="ll-hero-grid">
            <div className="ll-hero-copy">
              <span className="eyebrow">Personal Bible study notes</span>
              <h1 className="ll-h1 serif">
                Keep what you see
                <br />
                in the <span className="ll-lamp">light</span> of the Word.
              </h1>
              <p className="ll-lead">
                Lantern is a calm reading Bible with a place to write. Notice something, look up the
                history, apply it, sit with it. Your study stays beside the verse, ready the next
                time you open the passage.
              </p>
              <div className="ll-hero-actions">
                <button className="ll-btn ll-btn-primary" type="button" onClick={openLogin}>
                  Get started
                </button>
                <button className="ll-btn ll-btn-ghost" type="button" onClick={openLogin}>
                  Sign in
                </button>
              </div>
              <p className="ll-hero-fine">Free to use. Your notes stay private to you.</p>
              <div className="ll-hero-verse">
                <span className="ll-v serif">
                  "Your word is a lamp to my feet and a light to my path."
                </span>
                <span className="ll-cite">Psalm 119:105</span>
              </div>
            </div>

            <HeroFlythrough />
          </div>
        </div>
      </section>

      <div className="ll-wrap ll-features">
        <FeatureClips />
      </div>

      <section className="ll-cta">
        <div className="ll-wrap">
          <div className="ll-cta-inner">
            <div>
              <h2 className="serif">Start your first study today.</h2>
              <p>One passage and a few notes. It will be here when you come back.</p>
            </div>
            <button className="ll-btn ll-btn-primary ll-btn-lg" type="button" onClick={openLogin}>
              Get started free
            </button>
          </div>
        </div>
      </section>

      <footer className="ll-footer">
        <div className="ll-wrap ll-foot">
          <Wordmark size={18} />
          <div>Personal Bible study notes. © 2026</div>
        </div>
      </footer>

      {showLogin && <SignIn onClose={() => setShowLogin(false)} />}
    </div>
  )
}
