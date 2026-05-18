import 'dart:ui';
import 'package:flame/camera.dart';
import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flame/game.dart';
import '../../core/constants.dart';
import '../../core/iso_math.dart';
import '../../core/palette.dart';
import 'components/avatar_component.dart';
import 'components/chat_bubble.dart';
import 'components/floor_tile.dart';
import 'components/wall_tile.dart';

class DenGame extends FlameGame with TapCallbacks {
  final String roomOwnerId;
  final String myUserId;

  late AvatarComponent _myAvatar;
  final Map<String, AvatarComponent> _avatars = {};

  // For a 10×8 room:
  //   leftmost X  = -256, rightmost X = 320, width = 576
  //   top Y       = -16,  bottom Y    = 272
  //   room center = (32, 128)
  static const double _roomCX = 32.0;
  static const double _roomCY = 128.0;
  static const double _roomW = 576.0;

  DenGame({required this.roomOwnerId, required this.myUserId});

  @override
  Color backgroundColor() => DenPalette.skyBottom;

  @override
  Future<void> onLoad() async {
    await super.onLoad();

    // ── Floor ─────────────────────────────────────────────────────────
    for (int r = 0; r < roomRows; r++) {
      for (int c = 0; c < roomCols; c++) {
        world.add(FloorTile(col: c, row: r, alt: (c + r) % 2 == 0));
      }
    }

    // ── Back walls (one continuous panel per side) ───────────────────
    world.add(WallTile(side: WallSide.backRight));
    world.add(WallTile(side: WallSide.backLeft));

    // ── My avatar ────────────────────────────────────────────────────
    _myAvatar = AvatarComponent(
      col: 5,
      row: 5,
      isMe: true,
      userId: myUserId,
      config: const AvatarConfig(shirt: DenPalette.shirtBlue),
    );
    world.add(_myAvatar);
    _avatars[myUserId] = _myAvatar;

    // ── Friend avatar (demo) ──────────────────────────────────────────
    final friend = AvatarComponent(
      col: 3,
      row: 3,
      isMe: false,
      userId: roomOwnerId,
      config: const AvatarConfig(
        shirt: DenPalette.shirtRed,
        hair: Color(0xFF1A1A6E),
      ),
    );
    world.add(friend);
    _avatars[roomOwnerId] = friend;

    // ── Camera ────────────────────────────────────────────────────────
    final zoom = (size.x * 0.92) / _roomW;
    camera.viewfinder
      ..anchor = Anchor.center
      ..zoom = zoom
      ..position = Vector2(_roomCX, _roomCY);
  }

  /// Tap on the floor -> move my avatar there.
  @override
  void onTapUp(TapUpEvent event) {
    final worldPos = camera.viewfinder.globalToLocal(event.devicePosition);
    final tile = screenToTile(worldPos.x, worldPos.y);
    final tc = tile.dx.round();
    final tr = tile.dy.round();

    if (tc >= 0 && tc < roomCols && tr >= 0 && tr < roomRows) {
      _myAvatar.walkTo(tc, tr);
      // TODO: send move packet over WebSocket
    }
  }

  /// Spawn a floating chat bubble above the given user's avatar.
  /// If the user isn't in the room, no-op.
  void spawnChatBubble(String userId, String text) {
    final a = _avatars[userId];
    if (a == null) return;
    world.add(ChatBubbleComponent(text: text, origin: a.headWorldPosition()));
  }

  void onRemoteMove(String userId, int col, int row) {
    _avatars[userId]?.walkTo(col, row);
  }

  void onAvatarJoined(String userId, int col, int row, AvatarConfig config) {
    if (_avatars.containsKey(userId)) return;
    final avatar = AvatarComponent(
      col: col, row: row, isMe: false, userId: userId, config: config,
    );
    world.add(avatar);
    _avatars[userId] = avatar;
  }

  void onAvatarLeft(String userId) {
    _avatars[userId]?.removeFromParent();
    _avatars.remove(userId);
  }
}
