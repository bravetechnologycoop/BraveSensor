/*
 * Project sound-light-prototype
 * 
 * Description: Particle Argon firmware for sound & light prototype
 * 
 * Author(s): Blake Shular
 *            Maria Phelan
 */
#include "Particle.h"
#include <stdlib.h>

#define BUZZER D6
#define BUTTON D5

int start_siren(String command); // cloud function
void button_interrupt();
void timer_overflow();
void publish_messages();

int flag = 0;
Timer timer(5000, timer_overflow, true);

void setup()
{
    Particle.publishVitals(60);
    Particle.function("start", start_siren);
    Particle.function("Timer Length (integer in ms)", change_timer_length);

    pinMode(BUTTON, INPUT);
    pinMode(BUZZER, OUTPUT);
}

void loop()
{
    publish_messages();
}

int change_timer_length(String command)
{
    char command_arr[command.length() + 1];
    strcpy(command_arr, command.c_str());
    for (unsigned int i = 0; i < command.length(); i++)
    {
        char temp = command_arr[i];
        if (temp != '0' && temp != '1' && temp != '2' && temp != '3' && temp != '4' && temp != '5' && temp != '6' && temp != '7' && temp != '8' && temp != '9')
        {
            flag = 4;
            return -1;
        }
    }
    timer.changePeriod(atoi(command));
    flag = 5;
    return 1;
}

int start_siren(String command)
{
    if (command != "start")
    { // check for correct command
        Particle.publish("wrong-command");
        return -1;
    }

    attachInterrupt(BUTTON, button_interrupt, RISING);
    digitalWrite(BUZZER, HIGH);
    timer.start();
    flag = 3; // alarm sounded msg
    return 1;
}

void timer_overflow()
{
    detachInterrupt(BUTTON);
    digitalWrite(BUZZER, LOW);
    flag = 2; // escalate response msg
}

void button_interrupt()
{
    detachInterrupt(BUTTON);
    digitalWrite(BUZZER, LOW);
    timer.stop();
    flag = 1; // button pressed msg
}

void publish_messages()
{
    switch (flag)
    {
    case 0:
        break;
    case 1:
        Particle.publish("siren-addressed");
        Particle.publish("addressed", "siren-addressed", PRIVATE);
        flag = 0;
        break;
    case 2:
        Particle.publish("escalate-siren");
        Particle.publish("escalate", "escalate-siren", PRIVATE);
        flag = 0;
        break;
    case 3:
        Particle.publish("alarm-sounded");
        flag = 0;
        break;
    case 4:
        Particle.publish("positive-integer-please");
        flag = 0;
        break;
    case 5:
        Particle.publish("timer-length-updated");
        flag = 0;
        break;
    default:
        break;
    }
}
