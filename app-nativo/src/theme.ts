export const theme = {
  colors: {
    background: '#171B18', surface: '#1D221F', field: '#252B27',
    ivory: '#F3EBDC', secondary: '#CFC6B6', muted: '#8F887C',
    cherry: '#C5292D', cherryPressed: '#A51F23', champagne: '#BFA577', sage: '#607568',
    line: 'rgba(243,235,220,0.1)', lineStrong: 'rgba(243,235,220,0.18)',
    error: '#FF8A8D', scrim: 'rgba(23,27,24,0.65)',
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, section: 40 },
  radius: { field: 14, button: 16, card: 18 },
  fonts: {
    display: 'BodoniModa_500Medium', italic: 'BodoniModa_400Regular_Italic',
    body: 'Manrope_400Regular', medium: 'Manrope_500Medium', semibold: 'Manrope_600SemiBold',
  },
  motion: { duration: 750, stagger: 80 },
} as const;
