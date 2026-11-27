import 'coin_toss_motion.dart';

typedef CoinSoundCue = ({double at, double volume, int variant});

const coinCollisionAssets = [
  'src/features/divination/assets/coins/collision/coin-collision-1.wav',
  'src/features/divination/assets/coins/collision/coin-collision-2.wav',
  'src/features/divination/assets/coins/collision/coin-collision-3.wav',
];

const coinSoundMasterVolume = 0.68;
const reducedCoinSoundCues = [(at: 0.0, volume: 0.64, variant: 0)];

final coinSoundCues = List<CoinSoundCue>.unmodifiable([
  (at: 0.0, volume: 0.28, variant: 0),
  (at: 0.16, volume: 0.24, variant: 1),
  (at: 0.36, volume: 0.32, variant: 0),
  (
    at: coinLandingTimes.first * coinTossDuration.inMilliseconds / 1000,
    volume: 0.97,
    variant: 2,
  ),
]);
