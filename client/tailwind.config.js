/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        ink: {
          950: '#070b18',
          900: '#0b1120',
          800: '#111a30',
          700: '#1a2440',
        },
        mint: '#22d3a5',
        peach: '#fb923c',
        wa: {
          green: '#25d366',
          teal: '#00a884',
          tealdeep: '#008069',
          tick: '#53bdeb',
          header: '#f0f2f5',
          headerdark: '#202c33',
          side: '#ffffff',
          sidedark: '#111b21',
          chatbg: '#efeae2',
          chatdark: '#0b141a',
          out: '#d9fdd3',
          outdark: '#005c4b',
          in: '#ffffff',
          indark: '#1f2c34',
          icon: '#54656f',
          icondark: '#aebac1',
          text: '#111b21',
          textdark: '#e9edef',
          sub: '#667781',
          subdark: '#8696a0',
          input: '#f0f2f5',
          inputdark: '#2a3942',
          encrypt: '#fef3c7',
          encryptdark: '#182229',
        },
      },
      fontFamily: {
        display: ['Sora', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 30px -12px rgba(79,70,229,.25)',
        glow: '0 0 0 1px rgba(99,102,241,.25), 0 8px 40px -8px rgba(99,102,241,.45)',
        pop: '0 20px 60px -15px rgba(2,6,23,.35)',
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.75rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(18px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'orb-drift': {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(30px,-24px) scale(1.08)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'typing-bounce': {
          '0%, 80%, 100%': { transform: 'scale(.7)', opacity: '.5' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.21,.9,.35,1) both',
        'fade-in': 'fade-in .35s ease both',
        'slide-in-right': 'slide-in-right .4s cubic-bezier(.21,.9,.35,1) both',
        'pop-in': 'pop-in .25s cubic-bezier(.21,.9,.35,1) both',
        float: 'float 7s ease-in-out infinite',
        'orb-drift': 'orb-drift 12s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
