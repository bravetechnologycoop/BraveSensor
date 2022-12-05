/*
 * Mock implementation for Thread functions and classes
 */

#pragma once

struct os_thread_fn_t {};

class Thread
{
public:
    Thread() {}

    Thread(const char* name, void (*)(void*)) {}
};