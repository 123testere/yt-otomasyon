import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';

// latin-ext: Türkçe karakterler (ğ, ş, İ, ı) için gerekli.
export const display = loadAnton('normal', { weights: ['400'], subsets: ['latin', 'latin-ext'] }).fontFamily;
export const body = loadMontserrat('normal', { weights: ['800'], subsets: ['latin', 'latin-ext'] }).fontFamily;
import { loadFont as loadLora } from '@remotion/google-fonts/Lora';

// Lamba Altında (ansiklopedi teması): tek serif aile, düz ve italik.
export const serif = loadLora('normal', { weights: ['500', '700'], subsets: ['latin', 'latin-ext'] }).fontFamily;
loadLora('italic', { weights: ['500'], subsets: ['latin', 'latin-ext'] });
