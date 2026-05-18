import 'package:flame/components.dart';
import 'package:flutter/painting.dart';
import '../../../core/constants.dart';
import '../../../core/iso_math.dart';
import '../../../core/palette.dart';

/// One isometric floor tile.
/// Position = screen-space center of the diamond; anchor = center.
/// Checkerboard pattern alternates floorTopA / floorTopB.
class FloorTile extends PositionComponent {
  final int col;
  final int row;
  final bool alt; // checkerboard alt colour

  // Tile face height (gives a subtle raised-block look)
  static const double _faceH = 5.0;

  static final Paint _outlinePaint = Paint()
    ..color = DenPalette.floorOutline
    ..style = PaintingStyle.stroke
    ..strokeWidth = 0.75;

  FloorTile({required this.col, required this.row, this.alt = false})
      : super(
          position: () {
            final s = tileToScreen(col, row);
            return Vector2(s.dx, s.dy);
          }(),
          size: Vector2(tileW, tileH + _faceH),
          anchor: Anchor.topCenter, // top vertex of diamond at position
          priority: tileDepth(col, row),
        );

  @override
  void render(Canvas canvas) {
    final w = size.x;   // 64
    final dh = tileH;   // 32 — just the diamond portion

    // ── Top face (diamond) ──────────────────────────────
    // Vertices relative to top-left of bounding box:
    //   top    = (w/2, 0)
    //   right  = (w,   dh/2)
    //   bottom = (w/2, dh)
    //   left   = (0,   dh/2)
    final topFace = Path()
      ..moveTo(w / 2, 0)
      ..lineTo(w, dh / 2)
      ..lineTo(w / 2, dh)
      ..lineTo(0, dh / 2)
      ..close();

    canvas.drawPath(
      topFace,
      Paint()..color = alt ? DenPalette.floorTopB : DenPalette.floorTopA,
    );
    canvas.drawPath(topFace, _outlinePaint);

    // ── Left face (bottom-left edge dropping down by _faceH) ──────────
    final leftFace = Path()
      ..moveTo(0, dh / 2)
      ..lineTo(w / 2, dh)
      ..lineTo(w / 2, dh + _faceH)
      ..lineTo(0, dh / 2 + _faceH)
      ..close();
    canvas.drawPath(leftFace, Paint()..color = DenPalette.floorLeftFace);
    canvas.drawPath(leftFace, _outlinePaint);

    // ── Right face ────────────────────────────────────────────────────
    final rightFace = Path()
      ..moveTo(w / 2, dh)
      ..lineTo(w, dh / 2)
      ..lineTo(w, dh / 2 + _faceH)
      ..lineTo(w / 2, dh + _faceH)
      ..close();
    canvas.drawPath(rightFace, Paint()..color = DenPalette.floorRightFace);
    canvas.drawPath(rightFace, _outlinePaint);
  }
}
