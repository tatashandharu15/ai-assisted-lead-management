process.env.DATABASE_PATH = ':memory:';
import { describe, it, expect } from 'vitest';
import { extractSource } from '../src/services/source-extract.js';

describe('source-extract 10 cases', () => {
  it('SFF booth QR -> Event', () => {
    const r = extractSource('SFF booth QR scan visitor');
    expect(r.channel).toBe('Event');
  });
  it('Referred by -> Referral', () => {
    const r = extractSource('Referred by John Smith from Acme Inc');
    expect(r.channel).toBe('Referral');
  });
  it('LinkedIn dm inbound -> LinkedIn', () => {
    const r = extractSource('DM inbound via LinkedIn message');
    expect(r.channel).toBe('LinkedIn');
  });
  it('Googled us page -> Organic Search', () => {
    const r = extractSource('He googled us and found our pricing page');
    expect(r.channel).toBe('Organic Search');
  });
  it('Manual added -> Manual/Sales', () => {
    const r = extractSource('Manual added by sales ops team');
    expect(r.channel).toBe('Manual/Sales');
  });
  it('Form filled on pricing -> Website', () => {
    const r = extractSource('She filled out the form on the pricing page');
    expect(r.channel).toBe('Website');
  });
  it('Unknown gibberish -> Other', () => {
    const r = extractSource('xyzqwert abcd');
    expect(r.channel).toBe('Other');
  });
  it('SaaStr Annual booth -> Event', () => {
    const r = extractSource('Met at SaaStr Annual booth');
    expect(r.channel).toBe('Event');
  });
  it('LinkedIn commenting -> LinkedIn', () => {
    const r = extractSource('LinkedIn after commenting on our post');
    expect(r.channel).toBe('LinkedIn');
  });
  it('Google ad booked demo -> Website (not organic because of ad)', () => {
    const r = extractSource('Clicked Google ad then booked a demo');
    expect(r.channel).toBe('Website');
  });
});
