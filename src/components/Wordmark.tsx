import React from 'react'

interface WordmarkProps {
  /** Rendered size in px (maps 1:1 to the outline's original em square). */
  size?: number
  className?: string
  style?: React.CSSProperties
}

// Outlined from the self-hosted static Source Serif 4, weight 600 — the exact
// cut `.wordmark` used to render as live text — via HarfBuzz shaping (so the
// font's real GPOS kerning and the `.wordmark` -0.02em letter-spacing are
// baked into these coordinates) and fontTools for the glyph outlines. 1000
// units/em; VIEW_BOX_WIDTH is the glyphs' natural advance width, so `size`
// behaves like the old font-size prop.
//
// The vertical box is NOT the glyphs' ink bounds — `.wordmark` sets
// `line-height: 1`, and CSS numeric line-height makes the rendered box
// exactly 1 em tall regardless of how much ink is in it. A box cropped to
// ink (as an earlier version of this file did) renders ~32% short and
// shifts anything in the nav that aligns against it. The box below is
// derived from this font's own hhea/OS2 metrics (ascent 1036, descent -335,
// lineGap 0 — read from source-serif-4-latin-600-normal.woff via fontTools;
// USE_TYPO_METRICS is set, and hhea already matches the typo values) via the
// CSS2.1 inline-box half-leading formula, so the baseline lands at the same
// spot inside the box that line-height: 1 puts it for live text:
//   halfLeading = (lineHeightUnits - (ascent - descent)) / 2
//               = (1000 - (1036 - -335)) / 2 = -185.5
//   viewBox y   = -(ascent + halfLeading) = -(1036 + -185.5) = -850.5
//   viewBox h   = lineHeightUnits = 1000
// See docs/BACKLOG.md.
const UNITS_PER_EM = 1000
const VIEW_BOX_WIDTH = 3725
const VIEW_BOX_Y = -850.5
const VIEW_BOX_HEIGHT = 1000
const WORDMARK_PATH =
  'M36 0V-58L168 -66H183V0ZM125 0Q126 -51 126 -102Q126 -153 126 -203Q126 -253 126 -301V-358Q126 -410 126 -461Q126 -512 126 -563Q126 -614 125 -664H264Q264 -613 263.5 -562.5Q263 -512 263 -461Q263 -410 263 -358V-297Q263 -251 263 -201.5Q263 -152 263.5 -101.5Q264 -51 264 0ZM197 0V-61H516L475 -25L512 -201H583L574 0ZM36 -606V-664H363V-606L222 -598H168Z M774 15Q716 15 676.5 -19Q637 -53 637 -116Q637 -153 653.5 -182.5Q670 -212 709 -235Q748 -258 814 -275Q842 -283 869 -290Q896 -297 923 -304.5Q950 -312 977 -318V-276Q944 -266 910.5 -255.5Q877 -245 844 -235Q810 -225 791 -210.5Q772 -196 764.5 -178.5Q757 -161 757 -140Q757 -105 778.5 -85.5Q800 -66 836 -66Q856 -66 874 -73.5Q892 -81 912 -95Q932 -109 959 -131L965 -76H925Q906 -51 886 -30.5Q866 -10 839.5 2.5Q813 15 774 15ZM1043 13Q994 13 966 -14.5Q938 -42 934 -94L931 -96V-339Q931 -383 920.5 -408Q910 -433 888.5 -443.5Q867 -454 834 -454Q810 -454 787.5 -450Q765 -446 741 -437L788 -480L777 -396Q774 -356 756 -338Q738 -320 712 -320Q685 -320 670.5 -333.5Q656 -347 651 -368Q662 -433 719.5 -470.5Q777 -508 870 -508Q930 -508 971 -490Q1012 -472 1033.5 -433Q1055 -394 1055 -330V-108Q1055 -84 1064 -73Q1073 -62 1090 -62Q1101 -62 1110.5 -66Q1120 -70 1128 -76L1146 -40Q1130 -16 1104 -1.5Q1078 13 1043 13Z M1165 0V-53L1273 -63H1325L1426 -53V0ZM1235 0Q1235 -30 1235.5 -67Q1236 -104 1236 -143Q1236 -182 1236 -215V-269Q1236 -294 1236 -314.5Q1236 -335 1235.5 -354.5Q1235 -374 1235 -394L1160 -399V-447L1313 -502L1343 -497L1357 -389L1362 -388V-215Q1362 -182 1362.5 -143Q1363 -104 1363 -67Q1363 -30 1364 0ZM1493 0V-53L1596 -63H1648L1754 -53V0ZM1558 0Q1559 -30 1559 -67Q1559 -104 1559.5 -142.5Q1560 -181 1560 -215V-315Q1560 -370 1541.5 -392.5Q1523 -415 1483 -415Q1460 -415 1436.5 -407.5Q1413 -400 1389 -385.5Q1365 -371 1340 -350L1336 -403H1364Q1386 -434 1412.5 -457.5Q1439 -481 1470.5 -494.5Q1502 -508 1539 -508Q1610 -508 1647.5 -464.5Q1685 -421 1685 -334V-215Q1685 -181 1685.5 -142.5Q1686 -104 1686 -67Q1686 -30 1687 0Z M1911 -427V-492H2098V-427ZM1983 12Q1921 12 1883.5 -20.5Q1846 -53 1846 -125Q1846 -146 1846.5 -166.5Q1847 -187 1847 -211V-427H1769V-482L1892 -497L1848 -464L1898 -633H1979L1968 -463L1972 -453V-135Q1972 -97 1988 -80.5Q2004 -64 2032 -64Q2049 -64 2063.5 -69Q2078 -74 2090 -82L2114 -41Q2103 -28 2085 -15.5Q2067 -3 2041.5 4.5Q2016 12 1983 12Z M2391 14Q2314 14 2257 -17Q2200 -48 2169.5 -105Q2139 -162 2139 -242Q2139 -322 2170.5 -382Q2202 -442 2258 -475Q2314 -508 2385 -508Q2449 -508 2496.5 -483Q2544 -458 2570 -412.5Q2596 -367 2596 -305Q2596 -285 2594 -268.5Q2592 -252 2589 -239H2216V-289H2446Q2466 -297 2472.5 -310.5Q2479 -324 2479 -346Q2479 -381 2467.5 -405Q2456 -429 2435 -441.5Q2414 -454 2384 -454Q2351 -454 2325 -434Q2299 -414 2283.5 -371Q2268 -328 2268 -257Q2268 -195 2288.5 -153Q2309 -111 2344.5 -89.5Q2380 -68 2426 -68Q2475 -68 2507.5 -85Q2540 -102 2565 -131L2601 -102Q2580 -68 2551.5 -41.5Q2523 -15 2484 -0.5Q2445 14 2391 14Z M2656 0V-53L2764 -63H2824L2945 -53V0ZM2726 0Q2726 -30 2726.5 -67Q2727 -104 2727 -143Q2727 -182 2727 -215V-269Q2727 -294 2727 -314.5Q2727 -335 2726.5 -354.5Q2726 -374 2726 -394L2650 -399V-447L2805 -502L2835 -497L2846 -364L2853 -363V-215Q2853 -182 2853 -143Q2853 -104 2853.5 -67Q2854 -30 2854 0ZM2841 -279 2829 -360H2858Q2873 -407 2894.5 -439.5Q2916 -472 2942 -489Q2968 -506 3000 -506Q3032 -506 3053.5 -489Q3075 -472 3082 -446Q3080 -412 3061.5 -389Q3043 -366 3010 -366Q2987 -366 2969.5 -376Q2952 -386 2938 -403L2916 -426L2967 -425Q2922 -404 2890.5 -365.5Q2859 -327 2841 -279Z M3110 0V-53L3218 -63H3270L3371 -53V0ZM3180 0Q3180 -30 3180.5 -67Q3181 -104 3181 -143Q3181 -182 3181 -215V-269Q3181 -294 3181 -314.5Q3181 -335 3180.5 -354.5Q3180 -374 3180 -394L3105 -399V-447L3258 -502L3288 -497L3302 -389L3307 -388V-215Q3307 -182 3307.5 -143Q3308 -104 3308 -67Q3308 -30 3309 0ZM3438 0V-53L3541 -63H3593L3699 -53V0ZM3503 0Q3504 -30 3504 -67Q3504 -104 3504.5 -142.5Q3505 -181 3505 -215V-315Q3505 -370 3486.5 -392.5Q3468 -415 3428 -415Q3405 -415 3381.5 -407.5Q3358 -400 3334 -385.5Q3310 -371 3285 -350L3281 -403H3309Q3331 -434 3357.5 -457.5Q3384 -481 3415.5 -494.5Q3447 -508 3484 -508Q3555 -508 3592.5 -464.5Q3630 -421 3630 -334V-215Q3630 -181 3630.5 -142.5Q3631 -104 3631 -67Q3631 -30 3632 0Z'

/**
 * The Lantern wordmark — the brand IS the word.
 *
 * After a long exploration, every pictorial mark failed a real test: a lantern
 * object is too complex to reduce (reads as a bag/bell/jar), an open book is
 * depth-ambiguous at mark size, and a lamp contradicts the name (a lantern is
 * carried; a pendant is fixed). So the identity is wordmark-only.
 *
 * Rendered as static outlined SVG geometry (not live text): font-independent,
 * so it never depends on the self-hosted Source Serif 4 having loaded, and can
 * use the display 600 cut's real shapes regardless of runtime font state.
 * `fill="currentColor"` so `.wordmark`'s `color: var(--text)` still drives it
 * under every theme, exactly as the live text did.
 */
export default function Wordmark({
  size = 22,
  className,
  style
}: WordmarkProps): React.JSX.Element {
  return (
    <svg
      className={`wordmark${className ? ` ${className}` : ''}`}
      style={style}
      width={(size * VIEW_BOX_WIDTH) / UNITS_PER_EM}
      height={(size * VIEW_BOX_HEIGHT) / UNITS_PER_EM}
      viewBox={`0 ${VIEW_BOX_Y} ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`}
      fill="currentColor"
      role="img"
      aria-label="Lantern"
    >
      <path d={WORDMARK_PATH} />
    </svg>
  )
}
