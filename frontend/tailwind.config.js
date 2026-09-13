/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Blue / cream / navy.
      //
      // `alert` and `amber` are deliberately NOT on the blue axis: they mean
      // danger and moderate, and carry that meaning in risk badges, risk
      // readouts, the destructive button and every form error. A blue error
      // message reads as ordinary text, so they stay red and amber. Everything
      // decorative that happened to use them has moved to `navy`.
      colors: {
        ink: '#0D1B33',
        paper: '#F5F1E6',
        surface: '#FFFFFF',
        pulse: {
          DEFAULT: '#1D5FAB',
          dim: '#DCE8F7',
          dark: '#123A6B',
        },
        navy: '#16325B',
        amber: '#B4722A',
        alert: '#B03A3A',
        muted: '#55637A',
        line: '#DCE1E8',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
      },
      keyframes: {
        // The marquee track renders its list twice, so shifting by exactly
        // -50% lands the copy where the original started — a seamless loop.
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        beam: {
          from: { offsetDistance: '0%' },
          to: { offsetDistance: '100%' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        marquee: 'marquee 38s linear infinite',
        beam: 'beam 6s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
}
