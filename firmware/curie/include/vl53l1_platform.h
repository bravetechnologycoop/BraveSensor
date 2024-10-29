/**
  *
  * Copyright (c) 2023 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */


#ifndef _VL53L1_PLATFORM_H_
#define _VL53L1_PLATFORM_H_

#include "vl53l1_types.h"
#include "i2cInterface.h"

#ifdef __cplusplus
extern "C"
{
#endif

/** @brief VL53L1_WrByte() definition.\n
 * To be implemented by the developer
 */
int8_t VL53L1_WrByte(
		uint16_t dev,
		uint16_t      index,
		uint8_t       data);
/** @brief VL53L1_WrWord() definition.\n
 * To be implemented by the developer
 */
int8_t VL53L1_WrWord(
		uint16_t dev,
		uint16_t      index,
		uint16_t      data);
/** @brief VL53L1_WrDWord() definition.\n
 * To be implemented by the developer
 */
int8_t VL53L1_WrDWord(
		uint16_t dev,
		uint16_t      index,
		uint32_t      data);
/** @brief VL53L1_RdByte() definition.\n
 * To be implemented by the developer
 */
int8_t VL53L1_RdByte(
		uint16_t dev,
		uint16_t      index,
		uint8_t      *pdata);
/** @brief VL53L1_RdWord() definition.\n
 * To be implemented by the developer
 */
int8_t VL53L1_RdWord(
		uint16_t dev,
		uint16_t      index,
		uint16_t     *pdata);
/** @brief VL53L1_RdDWord() definition.\n
 * To be implemented by the developer
 */
int8_t VL53L1_RdDWord(
		uint16_t dev,
		uint16_t      index,
		uint32_t     *pdata);
/** @brief VL53L1_WaitMs() definition.\n
 * To be implemented by the developer
 */
int8_t VL53L1_WaitMs(
		uint16_t dev,
		int32_t       wait_ms);

int8_t VL53L1_WriteMulti(uint16_t dev,
		uint16_t index, uint8_t *pdata, uint32_t count);

int8_t VL53L1_ReadMulti(uint16_t dev,
		uint16_t index, uint8_t *pdata, uint32_t count);

int8_t VL53L1X_UltraLite_Linux_Interrupt_Init(void);

int8_t VL53L1X_UltraLite_WaitForInterrupt(int IoctlWfiNumber);

int8_t VL53L1X_UltraLite_Linux_I2C_Init(i2cInterface * i2c, uint16_t i2caddress);

#ifdef __cplusplus
}
#endif

#endif
