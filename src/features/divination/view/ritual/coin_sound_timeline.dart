import 'coin_toss_motion.dart';

typedef CoinSoundCue = ({double at, double volume, int variant});

const coinCollisionAssets = [
  'src/features/divination/assets/coins/collision/coin-collision-1.wav',
  'src/features/divination/assets/coins/collision/coin-collision-2.wav',
  'src/features/divination/assets/coins/collision/coin-collision-3.wav',
];

const coinSoundRate = 1.22;
const coinSoundMasterVolume = 0.20;
const reducedCoinSoundCues = [(at: 0.0, volume: 0.55, variant: 0)];

final coinSoundCues = List<CoinSoundCue>.unmodifiable(
  [
    (at: 0.0, volume: 0.22, variant: 0),
    (at: 0.16, volume: 0.16, variant: 1),
    (at: 0.36, volume: 0.20, variant: 2),
    for (final (index, time) in coinLandingTimes.indexed)
      (at: time * _duration, volume: 0.56 - index * 0.025, variant: index),
    (at: coinLandingTimes.first * _duration + 0.05, volume: 0.12, variant: 1),
    (at: coinLandingTimes.last * _duration + 0.07, volume: 0.09, variant: 0),
  ]..sort((first, second) => first.at.compareTo(second.at)),
);

final _duration = coinTossDuration.inMilliseconds / 1000.0;
