import { Composition, registerRoot, Still } from 'remotion';
import { VideoComposition } from './VideoComposition.jsx';
import { Thumbnail } from './Thumbnail.jsx';

// Süre ve boyut motorun gönderdiği props'tan gelir (engine/src/pipeline/remotion.js).
const fromProps = ({ props }) => ({
  durationInFrames: props.durationInFrames,
  fps: props.fps,
  width: props.width,
  height: props.height,
});

const demoVideo = {
  fps: 30, width: 1080, height: 1920, durationInFrames: 150, portrait: true, lang: 'tr',
  scenes: [], words: [], narration: null, music: null, musicVolume: 0.12,
  badge: null, captions: 'kelime', captionColor: '#FFE600', hookText: 'Kanca yazısı',
};

function Root() {
  return (
    <>
      <Composition id="Video" component={VideoComposition} defaultProps={demoVideo}
        calculateMetadata={fromProps} fps={30} width={1080} height={1920} durationInFrames={150} />
      <Still id="Thumb" component={Thumbnail} width={1280} height={720}
        defaultProps={{ background: null, text: 'KAPAK YAZISI', badge: null, lang: 'tr', accent: '#FFE600' }} />
    </>
  );
}

registerRoot(Root);
