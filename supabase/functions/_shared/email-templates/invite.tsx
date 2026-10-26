/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="hr" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Pozvani ste da se pridružite {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Pozvani ste</Heading>
        <Text style={text}>
          Pozvani ste da se pridružite{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Kliknite gumb u nastavku kako biste prihvatili poziv i otvorili
          račun.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Prihvati poziv
        </Button>
        <Text style={footer}>
          Ako niste očekivali ovaj poziv, slobodno zanemarite ovu poruku.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
const link = { color: 'inherit', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(174, 62%, 47%)',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid hsl(174, 62%, 47%)',
  borderRadius: '16px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: hsl(174, 62%, 47%) !important; color: #ffffff !important; }
  }
  [data-ogsc] .dm-btn { background-color: hsl(174, 62%, 47%) !important; color: #ffffff !important; }
  [data-ogsb] .dm-btn { background-color: hsl(174, 62%, 47%) !important; color: #ffffff !important; }
`
