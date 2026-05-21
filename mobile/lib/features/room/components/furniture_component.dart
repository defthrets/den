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
  // Sprites are normalised so the visual base lands at y=92 in the 96-px frame.
  static const double _baseAnchorY = 92 / 96;
  // Overall furniture scale — smaller now so 1×1 items fit a tile.
  // 1.0 so 96 source × 2/3 zoom = 64 display: clean 3:2 downsample.
  static const double _baseScale = 1.0;

  final String itemId;
  final int col;
  final int row;
  /// Per-piece scale multiplier (e.g. sofa 1.7 to span 2 tiles, lamp 0.85).
  final double pieceScale;
  /// Footprint in tiles, e.g. [2,1] for a sofa.
  final List<int> footprint;
  /// Floor decals (rugs) render below everything that stands on the floor.
  final bool floorLayer;
  ui.Image? _sprite;

  FurnitureComponent({
    required this.itemId,
    required this.col,
    required this.row,
    this.pieceScale = 1.0,
    this.footprint = const [1, 1],
    this.floorLayer = false,
  }) : super(
          size: Vector2(frameW * _baseScale * pieceScale, frameH * _baseScale * pieceScale),
          anchor: Anchor(0.5, _baseAnchorY),
          priority: floorLayer
              ? 500 + tileDepth(col + (footprint[0] - 1) ~/ 2,
                                row + (footprint[1] - 1) ~/ 2)
              : 1000 + tileDepth(col + (footprint[0] - 1) ~/ 2,
                                  row + (footprint[1] - 1) ~/ 2) + 2,
        ) {
    // Centre on the footprint midpoint so multi-tile items straddle their tiles.
    final cx = col + (footprint[0] - 1) / 2.0;
    final cy = row + (footprint[1] - 1) / 2.0;
    final s = tileToScreen(cx.round(), cy.round());
    // For fractional centres (even footprint dims) shift in iso coords
    final dxCol = (footprint[0] - 1) / 2.0 - ((footprint[0] - 1) ~/ 2);
    final dxRow = (footprint[1] - 1) / 2.0 - ((footprint[1] - 1) ~/ 2);
    position = Vector2(
      s.dx + (dxCol - dxRow) * 32,
      s.dy + (dxCol + dxRow) * 16,
    );
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
