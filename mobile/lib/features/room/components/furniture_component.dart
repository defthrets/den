import 'dart:async';
import 'dart:ui' as ui;
import 'package:flame/components.dart';
import 'package:flutter/painting.dart';
import 'package:flutter/services.dart' show rootBundle;
import '../../../core/iso_math.dart';

/// A piece of furniture placed on a tile.
///
/// Each item is a 96×96 PNG with a transparent background generated via
/// Retro Diffusion's `rd_plus__isometric_asset` style + `remove_bg`. The
/// "feet" of the object (where it touches the floor) sit at ~85% down
/// the frame — same anchor trick we use for avatars so the base lands
/// on the tile center instead of the frame bottom.
class FurnitureComponent extends PositionComponent {
  static const double frameW = 96;
  static const double frameH = 96;
  static const double _baseAnchorY = 0.85;
  static const double _scale = 1.6;

  final String itemId;
  final int col;
  final int row;
  ui.Image? _sprite;

  FurnitureComponent({
    required this.itemId,
    required this.col,
    required this.row,
  }) : super(
          size: Vector2(frameW * _scale, frameH * _scale),
          anchor: Anchor(0.5, _baseAnchorY),
          priority: tileDepth(col, row) + 2,
        ) {
    final s = tileToScreen(col, row);
    position = Vector2(s.dx, s.dy);
  }

  @override
  Future<void> onLoad() async {
    final data = await rootBundle.load('assets/furniture/$itemId.png');
    final completer = Completer<ui.Image>();
    ui.decodeImageFromList(data.buffer.asUint8List(), completer.complete);
    _sprite = await completer.future;
  }

  @override
  void render(Canvas canvas) {
    final s = _sprite;
    if (s == null) return;
    canvas.drawImageRect(
      s,
      Rect.fromLTWH(0, 0, frameW, frameH),
      Rect.fromLTWH(0, 0, size.x, size.y),
      Paint()..filterQuality = FilterQuality.none,
    );
  }
}
