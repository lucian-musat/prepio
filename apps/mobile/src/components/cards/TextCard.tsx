import RichText from './RichText';

export default function TextCard({ text }: { text: string }) {
  return <RichText source={text} />;
}
