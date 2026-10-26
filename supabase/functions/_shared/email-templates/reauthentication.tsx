/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="hr" dir="ltr">
    <Head />
    <Preview>Vaš kod za potvrdu</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Potvrdite identitet</Heading>
        <Text style={text}>Upotrijebite kod u nastavku kako biste potvrdili svoj identitet:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Ovaj kod uskoro istječe. Ako niste zatražili ovaj kod, slobodno
          zanemarite ovu poruku.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(220, 15%, 15%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(220, 15%, 15%)',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
