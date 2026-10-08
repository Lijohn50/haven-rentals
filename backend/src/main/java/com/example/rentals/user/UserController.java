package com.example.rentals.user;

import com.example.rentals.common.CurrentUserProvider;
import com.example.rentals.user.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final CurrentUserProvider currentUser;

    @GetMapping("/users/me")
    public ResponseEntity<UserResponse> getMe() {
        return ResponseEntity.ok(userService.getMe(currentUser.getUserId()));
    }

    @PatchMapping("/users/me")
    public ResponseEntity<UserResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest req) {
        return ResponseEntity.ok(userService.updateProfile(currentUser.getUserId(), req));
    }

    @PostMapping("/users/me/become-host")
    public ResponseEntity<UserResponse> becomeHost(@Valid @RequestBody BecomeHostRequest req) {
        return ResponseEntity.ok(userService.becomeHost(currentUser.getUserId(), req));
    }

    @DeleteMapping("/users/me")
    public ResponseEntity<Void> deleteAccount(@Valid @RequestBody DeleteAccountRequest req) {
        userService.deleteAccount(currentUser.getUserId(), req);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/hosts/{userId}")
    public ResponseEntity<PublicHostResponse> getPublicHost(@PathVariable Long userId) {
        return ResponseEntity.ok(userService.getPublicHost(userId));
    }
}
