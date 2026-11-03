import type { Card } from '@prepio/shared';
import TextCard from './TextCard';
import ImagesCard from './ImagesCard';

/** Renders a card's body by type. Tasks 6-9 add one case each; unfinished types render nothing. */
export default function CardContentView({ card }: { card: Card }) {
  switch (card.type) {
    case 'text':
      return <TextCard text={card.text} />;
    case 'images':
      return <ImagesCard content={card} />;
    default:
      return null;
  }
}
