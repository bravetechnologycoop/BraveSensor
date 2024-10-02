CXX = g++
# Target and dependencies 
TARGET = curie 
SRCS = main.cpp braveDebug.cpp 
OBJS = $(subst .cpp,.o,$(SRCS))

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) -o $(TARGET) $(OBJS)

main.o: main.cpp
braveDebug.o: braveDebug.cpp

# Cleanup 
clean:
	rm $(OBJS)
