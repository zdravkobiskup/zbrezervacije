import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Block { title?: string; rows: { label: string; value: string }[]; tone?: 'default' | 'old' | 'new' }
interface Props {
  subject?: string
  heading?: string
  greetingName?: string
  paragraphs?: string[]
  blocks?: Block[]
  ctaText?: string
  ctaUrl?: string
  note?: string
}

const BookingEmail = ({ heading = 'Obavijest o rezervaciji', greetingName, paragraphs = [], blocks = [], ctaText, ctaUrl, note }: Props) => (
  <Html lang="hr" dir="ltr">
    <Head />
    <Preview>{heading}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>ZB rezervacije</Text>
        <Heading style={h1}>{heading}</Heading>
        <Text style={text}>Poštovani/a {greetingName || 'korisniče'},</Text>
        {paragraphs.map((p, i) => <Text key={i} style={text}>{p}</Text>)}
        {blocks.map((b, i) => (
          <Section key={i} style={b.tone === 'old' ? boxOld : box}>
            {b.title && <Text style={boxTitle}>{b.title}</Text>}
            {b.rows.map((r, j) => (
              <Text key={j} style={row}><strong>{r.label}:</strong> {r.value}</Text>
            ))}
          </Section>
        ))}
        {ctaText && ctaUrl && (
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={ctaUrl} style={button}>{ctaText}</Button>
          </Section>
        )}
        {note && <Text style={muted}>{note}</Text>}
        <Text style={muted}>Srdačan pozdrav,<br />ZB rezervacije tim</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingEmail,
  subject: (d: Record<string, any>) => d.subject || 'Obavijest o rezervaciji',
  displayName: 'Obavijest o rezervaciji',
  previewData: {
    subject: 'Potvrda rezervacije - Salon Ana',
    heading: 'Potvrda rezervacije',
    greetingName: 'Marija',
    paragraphs: ['Vaša rezervacija je uspješno kreirana!'],
    blocks: [{ title: 'Detalji rezervacije', rows: [
      { label: 'Pružatelj usluge', value: 'Salon Ana' },
      { label: 'Usluga', value: 'Šišanje' },
      { label: 'Datum', value: '28.10.2026.' },
      { label: 'Vrijeme', value: '10:00' },
    ] }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px' }
const brand = { fontSize: '14px', fontWeight: 'bold', color: '#1e2533', margin: '0 0 8px' }
const h1 = { fontSize: '24px', color: '#1e2533', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.5' }
const box = { backgroundColor: '#f0fdfa', borderRadius: '16px', padding: '16px 20px', margin: '16px 0' }
const boxOld = { ...box, backgroundColor: '#fef2f2' }
const boxTitle = { fontSize: '16px', fontWeight: 'bold', color: '#2db5a5', margin: '0 0 8px' }
const row = { fontSize: '14px', color: '#333333', margin: '4px 0' }
const button = { backgroundColor: '#2db5a5', color: '#ffffff', padding: '12px 24px', borderRadius: '16px', fontWeight: 'bold', textDecoration: 'none' }
const muted = { fontSize: '13px', color: '#6b7280', marginTop: '24px' }
