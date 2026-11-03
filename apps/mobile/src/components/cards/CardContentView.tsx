import type { Card } from '@prepio/shared';
import TextCard from './TextCard';
import ImagesCard from './ImagesCard';
import VideoCard from './VideoCard';
import TimelineCard from './TimelineCard';
import SchemaCard from './SchemaCard';

/** Renders a card's body by type. Task 9 adds the last case; unfinished types render nothing. */
export default function CardContentView({ card }: { card: Card }) {
  switch (card.type) {
    case 'text':
      return <TextCard text={card.text} />;
    case 'images':
      return <ImagesCard content={card} />;
    case 'video':
      return <VideoCard content={card} />;
    case 'timeline':
      return <TimelineCard content={card} />;
    case 'schema':
      return <SchemaCard content={card} />;
    default:
      return null;
  }
}
