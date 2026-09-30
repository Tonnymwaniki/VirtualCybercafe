// Phone storage doesn't exist under Jest; use the library's in-memory copy.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
