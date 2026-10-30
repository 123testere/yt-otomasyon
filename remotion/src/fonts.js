import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';

// latin-ext: Türkçe karakterler (ğ, ş, İ, ı) için gerekli.
export const display = loadAnton('normal', { weights: ['400'], subsets: ['latin', 'latin-ext'] }).fontFamily;
export const body = loadMontserrat('normal', { weights: ['800'], subsets: ['latin', 'latin-ext'] }).fontFamily;
