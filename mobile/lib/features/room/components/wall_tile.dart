import 'package:flame/components.dart';
import 'package:flutter/painting.dart';
import '../../../core/constants.dart';
import '../../../core/iso_math.dart';
import '../../../core/palette.dart';

enum WallSide { backRight, backLeft }

/// One continuous wall panel running along the back-right or back-left
/// edge of the room. Rendered as a single parallelogram with brick courses,
/// rather than per-tile segments — gives the smooth Habbo look.
class WallTile extends PositionComponent {
  final WallSide side;
  final int cols;
  final int rows;

  static const double _wallH = 96.0;

  WallTile({required this.side, this.cols = roomCols, this.rows = roomRows})
      : super(
          // Position is unused for rendering — we draw directly in world coords
          // using tileToScreen. priority places walls behind every floor tile.
          priority: -100,
        );

  @override
  void render(Canvas canvas) {
    final outline = Paint()
      ..color = DenPalette.wallOutline
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.75;

    if (side == WallSide.backRight) {
      // Bottom edge: back corner -> end of row 0
      final bL = _topVertex(0, 0);
      final bR = _topVertex(cols, 0);
      final tL = bL.translate(0, -_wallH);
      final tR = bR.translate(0, -_wallH);

      final path = Path()
        ..moveTo(bL.dx, bL.dy)
        ..lineTo(bR.dx, bR.dy)
        ..lineTo(tR.dx, tR.dy)
        ..lineTo(tL.dx, tL.dy)
        ..close();
      canvas.drawPath(path, Paint()..color = DenPalette.wallFaceLight);
      canvas.drawPath(path, outline);

      _drawCourses(canvas, bL, bR, cols);
    } else {
      final bR = _topVertex(0, 0);
      final bL = _topVertex(0, rows);
      final tL = bL.translate(0, -_wallH);
      final tR = bR.translate(0, -_wallH);

      final path = Path()
        ..moveTo(bL.dx, bL.dy)
        ..lineTo(bR.dx, bR.dy)
        ..lineTo(tR.dx, tR.dy)
        ..lineTo(tL.dx, tL.dy)
        ..close();
      canvas.drawPath(path, Paint()..color = DenPalette.wallFaceDark);
      canvas.drawPath(path, outline);

      _drawCourses(canvas, bL, bR, rows);
    }
  }

  Offset _topVertex(int col, int row) {
    final s = tileToScreen(col, row);
    return Offset(s.dx, s.dy - tileHHalf);
  }

  void _drawCourses(Canvas canvas, Offset bL, Offset bR, int divisions) {
    final coursePaint = Paint()
      ..color = DenPalette.wallOutline.withOpacity(0.35)
      ..strokeWidth = 0.5;

    // Horizontal brick courses
    for (double dy = 12; dy < _wallH; dy += 14) {
      canvas.drawLine(
        bL.translate(0, -dy),
        bR.translate(0, -dy),
        coursePaint,
      );
    }
    // Vertical mortar between bricks
    final dx = (bR.dx - bL.dx) / divisions;
    final dy = (bR.dy - bL.dy) / divisions;
    for (int i = 1; i < divisions; i++) {
      final bottom = Offset(bL.dx + dx * i, bL.dy + dy * i);
      canvas.drawLine(bottom, bottom.translate(0, -_wallH), coursePaint);
    }
  }
}
