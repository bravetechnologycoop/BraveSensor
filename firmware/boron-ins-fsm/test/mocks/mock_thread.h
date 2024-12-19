/* mock_thread.h - Mock implementation for Thread functions and classes
 *
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 */

#pragma once

struct os_thread_fn_t {};

class Thread {
public:
    Thread() {}

    Thread(const char* name, void (*)(void*)) {}
};