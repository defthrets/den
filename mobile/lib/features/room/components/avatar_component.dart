import 'dart:async';
import 'dart:math';
import 'dart:ui' as ui;
import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flutter/painting.dart';
import 'package:flutter/services.dart' show rootBundle;
import '../../../core/iso_math.dart';
import '../../../core/palette.dart';

/// Avatar configuration. Sprite-based: a preset id picks one of the
/// generated sprite sheets in assets/sprites/. Colour tinting is
/// baked into the sheet at generation time.
class AvatarConfig {
  final String preset;
  const AvatarConfig({this.preset = 'casual_blue_boy'});

  AvatarConfig copyWith({String? preset}) =>
      AvatarConfig(preset: preset ?? this.preset);

  factory AvatarConfig.fromJson(Map<String, dynamic> j) =>
      AvatarConfig(preset: (j['preset'] as String?) ?? 'casual_blue_boy');

  Map<String, dynamic> toServerPayload() => {'preset': preset};
}

enum AvatarState { idle, walking }

/// PixelLab sprite-sheet avatar.
/// Layout: 6 cols (walk frames) × 4 rows (facing direction). 92×92 each.
/// Row order: 0=south, 1=east, 2=north, 3=west.
/// Idle uses col 0 of the current direction's row.
class AvatarComponent extends PositionComponent with TapCallbacks {
  static const double frameW = 92;
  static const double frameH = 92;
  static const int walkFrames = 6;
  static const double _avatarScale = 1.5;
  // "shorter and fatter" Habbo proportions — squish vertical, slight horizontal stretch
  static const double _xFactor = 1.05;
  static const double _yFactor = 0.88;
  static const double walkDurationPerTile = 0.85;
  static const double walkFrameDuration = 0.14;

  static const int _dirS = 0;
  static const int _dirE = 1;
  static const int _dirN = 2;
  static const int _dirW = 3;

  /// Empirically tuned anchor so feet sit flush on the tile. Lower
  /// values shift the sprite DOWN. 0.93 floated; 0.87 went through.
  static const double _feetAnchorY = 0.90;

  int col;
  int row;
  final bool isMe;
  final String userId;
  AvatarConfig _config;

  ui.Image? _sheet;

  AvatarState _state = AvatarState.idle;
  int _targetCol = 0;
  int _targetRow = 0;
  double _walkProgress = 0;
  double _bobPhase = 0;

  int _walkFrame = 0;
  double _walkFrameTimer = 0;
  int _direction = _dirS;
  final List<List<int>> _pathQueue = [];

  AvatarComponent({
    required this.col,
    required this.row,
    required this.isMe,
    required this.userId,
    AvatarConfig? config,
  })  : _config = config ?? const AvatarConfig(),
        super(
          size: Vector2(frameW * _avatarScale * _xFactor, frameH * _avatarScale * _yFactor),
          anchor: Anchor(0.5, _feetAnchorY),
          priority: 1000 + tileDepth(col, row) + 5,
        ) {
    _bobPhase = Random().nextDouble() * pi * 2;
    _syncPosition();
  }

  AvatarConfig get config => _config;

  @override
  Future<void> onLoad() async {
    _sheet = await loadSpriteSheet(_config.preset);
  }

  Future<void> updateConfig(AvatarConfig next) async {
    _config = next;
    _sheet = await loadSpriteSheet(next.preset);
  }

  void _syncPosition() {
    final s = tileToScreen(col, row);
    position = Vector2(s.dx, s.dy);
    priority = 1000 + tileDepth(col, row) + 5;
  }

  void walkTo(int targetCol, int targetRow) {
    if (_state == AvatarState.walking) {
      // Cap the queue at 3 pending destinations; drop extra clicks.
      if (_pathQueue.length >= 3) return;
      _pathQueue.add([targetCol, targetRow]);
      return;
    }
    _startStep(targetCol, targetRow);
  }

  void _startStep(int targetCol, int targetRow) {
    _targetCol = targetCol;
    _targetRow = targetRow;
    _state = AvatarState.walking;
    _walkProgress = 0;
    _walkFrame = 0;
    _walkFrameTimer = 0;
    final dcol = targetCol - col;
    final drow = targetRow - row;
    // Screen-space: "south" = visually down. Iso tiles are 64×32 so a unit
    // of (dcol - drow) is twice as wide as a unit of (dcol + drow).
    final sx = dcol - drow;
    final sy = dcol + drow;
    if ((2 * sx).abs() > sy.abs()) {
      _direction = sx >= 0 ? _dirE : _dirW;
    } else {
      _direction = sy >= 0 ? _dirS : _dirN;
    }
  }

  Vector2 headWorldPosition() => Vector2(position.x, position.y - size.y);

  @override
  void update(double dt) {
    _bobPhase += dt * 2.5;
    if (_state == AvatarState.walking) {
      _walkProgress = min(1.0, _walkProgress + dt / walkDurationPerTile);

      _walkFrameTimer += dt;
      if (_walkFrameTimer >= walkFrameDuration) {
        _walkFrame = (_walkFrame + 1) % walkFrames;
        _walkFrameTimer = 0;
      }

      final fromS = tileToScreen(col, row);
      final toS = tileToScreen(_targetCol, _targetRow);
      final t = _easeInOut(_walkProgress);
      position = Vector2(
        fromS.dx + (toS.dx - fromS.dx) * t,
        fromS.dy + (toS.dy - fromS.dy) * t,
      );
      if (_walkProgress >= 1.0) {
        col = _targetCol;
        row = _targetRow;
        _state = AvatarState.idle;
        _walkFrame = 0;
        _walkFrameTimer = 0;
        _syncPosition();
        // Consume the next queued step (drop redundant ones where we already are).
        while (_pathQueue.isNotEmpty) {
          final next = _pathQueue.removeAt(0);
          if (next[0] == col && next[1] == row) continue;
          _startStep(next[0], next[1]);
          break;
        }
      }
    }
  }

  @override
  void render(Canvas canvas) {
    if (_sheet == null) return;

    final bob = _state == AvatarState.idle ? sin(_bobPhase) * 0.6 : 0.0;

    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.x / 2, size.y * _feetAnchorY),
        width: 18 * _avatarScale,
        height: 5 * _avatarScale,
      ),
      Paint()..color = const Color(0x47000000),
    );

    final frameCol = _state == AvatarState.walking ? _walkFrame : 0;
    final frameRow = _direction;

    canvas.save();
    canvas.translate(0, bob);
    canvas.drawImageRect(
      _sheet!,
      Rect.fromLTWH(frameCol * frameW, frameRow * frameH, frameW, frameH),
      Rect.fromLTWH(0, 0, size.x, size.y),
      Paint()..filterQuality = FilterQuality.none,
    );
    canvas.restore();

    canvas.drawCircle(
      Offset(size.x / 2, bob - 4),
      3,
      Paint()..color = isMe ? DenPalette.accent : const Color(0xFF88BBFF),
    );
  }

  static double _easeInOut(double t) =>
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/// Loads a sprite sheet from `assets/sprites/<preset>.png` and returns
/// a decoded [ui.Image]. Cached in the renderer's per-avatar `_sheet`.
Future<ui.Image> loadSpriteSheet(String preset) async {
  final data = await rootBundle.load('assets/sprites/$preset.png');
  final completer = Completer<ui.Image>();
  ui.decodeImageFromList(data.buffer.asUint8List(), completer.complete);
  return completer.future;
}
