import 'package:flame/components.dart';
import 'package:flutter/painting.dart';
import '../../../core/constants.dart';
import '../../../core/iso_math.dart';
import '../../../core/palette.dart';

enum WallSide { left, back }

/// Back-left wall panel (col=-1) and back-right wall panel (row=-1).
/// Drawn as a vertical parallelogram rising from the edge of the floor grid.
class WallTile extends PositionComponent {
  final int col;
  final int row;
  final WallSide side;

  static const double _wallH = 64.0; // visual height of wall in px

  static final Paint _outlinePaint = Paint()
    ..color = DenPalette.wallOutline
    ..style = PaintingStyle.stroke
    ..strokeWidth = 0.75;

  WallTile({required this.col, required this.row, required this.side})
      : super(
          position: () {
            final s = tileToScreen(col, row);
            return Vector2(s.dx, s.dy);
          }(),
          size: Vector2(tileW, tileH + _wallH),
          anchor: Anchor.topCenter,
          // Walls sit behind the floor tiles at the same col/row
          priority: tileDepth(col, row) - 1,
        );

  @override
  void render(Canvas canvas) {
    final w = size.x;
    final dh = tileH; // diamond height = 32

    if (side == WallSide.back) {
      // Back wall: right half of diamond top + vertical drop on right side
      //   top-right:  (w,   dh/2)
      //   top-center: (w/2, 0)
      //   top-left:   (0,   dh/2)  <- edge against left wall or corner
      // Then drops _wallH upward (in screen = upward = negative Y)
      final face = Path()
        ..moveTo(0, dh / 2)
        ..lineTo(w / 2, 0)
        ..lineTo(w, dh / 2)
        ..lineTo(w, dh / 2 - _wallH)
        ..lineTo(w / 2, -_wallH)
        ..lineTo(0, dh / 2 - _wallH)
        ..close();
      canvas.drawPath(face, Paint()..color = DenPalette.wallFaceLight);
      canvas.drawPath(face, _outlinePaint);

      // Horizontal mortar lines
      final mortarPaint = Paint()
        ..color = DenPalette.wallOutline.withOpacity(0.25)
        ..strokeWidth = 0.5;
      for (double dy = 8; dy < _wallH; dy += 16) {
        canvas.drawLine(Offset(0, dh / 2 - dy), Offset(w, dh / 2 - dy), mortarPaint);
      }
    } else {
      // Left wall: left half drops down
      final face = Path()
        ..moveTo(0, dh / 2)
        ..lineTo(w / 2, dh)
        ..lineTo(w / 2, dh - _wallH)
        ..lineTo(0, dh / 2 - _wallH)
        ..close();
      canvas.drawPath(face, Paint()..color = DenPalette.wallFaceDark);
      canvas.drawPath(face, _outlinePaint);

      final mortarPaint = Paint()
        ..color = DenPalette.wallOutline.withOpacity(0.2)
        ..strokeWidth = 0.5;
      for (double dy = 8; dy < _wallH; dy += 16) {
        canvas.drawLine(
            Offset(0, dh / 2 - dy), Offset(w / 2, dh - dy), mortarPaint);
      }
    }
  }
}
