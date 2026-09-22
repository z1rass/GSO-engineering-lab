import { z } from 'zod';

export const webUrl = z.url().max(2000).refine(value => { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; });
