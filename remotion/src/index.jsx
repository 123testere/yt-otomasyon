import { Composition, registerRoot, Still } from 'remotion';
import { VideoComposition } from './VideoComposition.jsx';
import { Thumbnail } from './Thumbnail.jsx';
import { League } from './League.jsx';
import { Duell } from './Duell.jsx';
import { AppIcon } from './AppIcon.jsx';
import { Encyclopedia, EncyclopediaThumb } from './Encyclopedia.jsx';
import { ShortCover } from './ShortCover.jsx';
import { Avatar, Banner } from './Brand.jsx';

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
      <Composition id="Ansiklopedi" component={Encyclopedia} defaultProps={{ ...demoVideo, captions: 'klasik' }}
        calculateMetadata={fromProps} fps={30} width={1080} height={1920} durationInFrames={150} />
      <Composition id="League" component={League} defaultProps={{ phases: [], data: null, words: [], fps: 30, width: 1080, height: 1920, durationInFrames: 150 }}
        calculateMetadata={fromProps} fps={30} width={1080} height={1920} durationInFrames={150} />
      <Composition id="Duell" component={Duell} defaultProps={{ phases: [], data: null, words: [], fps: 30, width: 1080, height: 1920, durationInFrames: 150 }}
        calculateMetadata={fromProps} fps={30} width={1080} height={1920} durationInFrames={150} />
      <Still id="AnsiklopediThumb" component={EncyclopediaThumb} width={1280} height={720}
        defaultProps={{ background: null, text: 'KAPAK YAZISI', lang: 'tr' }} />
      <Still id="ShortCover" component={ShortCover} width={1080} height={1920}
        defaultProps={{ background: null, text: 'KANCA YAZISI', badge: null, lang: 'tr', accent: '#FFE600', theme: null }} />
      <Still id="Banner" component={Banner} width={2560} height={1440}
        defaultProps={{ title: 'Kanal adı', tagline: '', accent: '#FFE600', theme: null }} />
      <Still id="Avatar" component={Avatar} width={800} height={800}
        defaultProps={{ title: 'Kanal adı', accent: '#FFE600', theme: null }} />
      <Still id="AppIcon" component={AppIcon} width={1024} height={1024} defaultProps={{ variant: 'full' }} />
      <Still id="Thumb" component={Thumbnail} width={1280} height={720}
        defaultProps={{ background: null, text: 'KAPAK YAZISI', badge: null, lang: 'tr', accent: '#FFE600' }} />
    </>
  );
}

registerRoot(Root);
