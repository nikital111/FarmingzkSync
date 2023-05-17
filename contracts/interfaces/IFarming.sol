// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IFarming {
    // Emitted when depositing
    event Deposit(address indexed depositor, uint256 deposit, uint256 date);

    // Emitted when claiming
    event Claim(
        address indexed recepient,
        uint256 deposit,
        uint256 rewards,
        uint256 date
    );

    // Deposits tokens to farm for get allocation
    // Emits a {Deposit} event
    function deposit(uint256 _amount) external;

    // Claims rewards and deposit
    // Emits a {Claim} event
    function claim() external returns (uint256);

    // View function to see pending tokens
    function pendingRewards(address _user) external returns (uint256);
}
