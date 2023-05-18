const currentTests =
  process.env.NODE_ENV == "zkSync"
    ? require("../testsVariants/testsZkSync")
    : require("../testsVariants/testsEth");

currentTests();
