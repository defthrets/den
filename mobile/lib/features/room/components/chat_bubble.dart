import 'dart:math';
import 'package:flame/components.dart';
import 'package:flutter/painting.dart';

/// Floating speech bubble that rises from where its sender was standing
/// and fades out after a few seconds. Spawns into the world layer so it's
/// scaled by the camera like the rest of the room.
class ChatBubbleComponent extends PositionComponent {
  static const double lifetime = 4.5;
  static const double riseSpeed = 26.0;

  final String text;
  double _age = 0;

  late final TextPainter _textPainter;
  late final double _bubbleW;
  static const double _bubbleH = 24.0;
  static const double _padX = 10.0;

  ChatBubbleComponent({required this.text, required Vector2 origin})
      : super(position: origin, priority: 99999, anchor: Anchor.bottomCenter) {
    _textPainter = TextPainter(
      text: TextSpan(
        text: _truncate(text),
        style: const TextStyle(
          color: Color(0xFF1A1A2E),
          fontSize: 13,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: 200);
    _bubbleW = min(220, _textPainter.width + _padX * 2);
    size = Vector2(_bubbleW, _bubbleH + 6);
  }

  String _truncate(String s) => s.length > 60 ? '${s.substring(0, 58)}…' : s;

  @override
  void update(double dt) {
    _age += dt;
    position.y -= riseSpeed * dt;
    if (_age >= lifetime) {
      removeFromParent();
    }
  }

  @override
  void render(Canvas canvas) {
    final fadeStart = lifetime * 0.7;
    final alpha = _age > fadeStart
        ? (1 - (_age - fadeStart) / (lifetime - fadeStart)).clamp(0.0, 1.0)
        : 1.0;
    final popIn = (_age / 0.15).clamp(0.0, 1.0);
    final a = alpha * popIn;

    final rect = Rect.fromLTWH(0, 0, _bubbleW, _bubbleH);
    final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(12));

    // Shadow
    canvas.drawRRect(
      rrect.shift(const Offset(1, 2)),
      Paint()..color = Color.fromRGBO(0, 0, 0, 0.30 * a),
    );

    // Bubble fill
    canvas.drawRRect(
      rrect,
      Paint()..color = Color.fromRGBO(255, 255, 255, a),
    );
    canvas.drawRRect(
      rrect,
      Paint()
        ..color = Color.fromRGBO(32, 40, 48, a)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );

    // Pointer (only while bubble is fresh)
    if (_age < 0.4) {
      final tail = Path()
        ..moveTo(_bubbleW / 2 - 5, _bubbleH)
        ..lineTo(_bubbleW / 2, _bubbleH + 6)
        ..lineTo(_bubbleW / 2 + 5, _bubbleH)
        ..close();
      canvas.drawPath(tail, Paint()..color = Color.fromRGBO(255, 255, 255, a));
      canvas.drawPath(
        tail,
        Paint()
          ..color = Color.fromRGBO(32, 40, 48, a)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2,
      );
    }

    // Text
    final textOffset = Offset(
      (_bubbleW - _textPainter.width) / 2,
      (_bubbleH - _textPainter.height) / 2,
    );
    canvas.saveLayer(rect, Paint()..color = Color.fromRGBO(0, 0, 0, a));
    _textPainter.paint(canvas, textOffset);
    canvas.restore();
  }
}
