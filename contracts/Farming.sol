// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import "./interfaces/IERC20.sol";
import "./interfaces/IFarming.sol";
import "./library/SafeMath.sol";

contract Farming is IFarming {
    using SafeMath for uint256;

    // User struct
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    // rewards per second in token0
    uint256 public rewardsPerSec;
    // Accumulated tokens per share
    uint256 public accRewardsPerShare;
    // last block.timestamp is rewarded
    uint256 public lastRewards;
    // token for rewards
    address public token0;
    // token for deposits
    address public token1;

    // Info of each user
    mapping(address => UserInfo) public userInfo;

    // total of tokens deposited at that time
    uint256 public total;

    constructor(address _token0, address _token1, uint256 _rewardsPerSec) {
        require(_token0 != address(0), "address 0");
        require(_token1 != address(0), "address 0");
        require(_rewardsPerSec > 0, "_rewardsPerSec must be greater than 0");

        token0 = _token0;
        token1 = _token1;
        rewardsPerSec = _rewardsPerSec;
    }

    // Update reward variables of farm
    function updateFarm() public {
        if (block.timestamp <= lastRewards) return;
        if (total == 0 || lastRewards == 0) {
            lastRewards = block.timestamp;
            return;
        }
        uint256 period = block.timestamp - lastRewards;
        uint256 rewards = period.mul(rewardsPerSec);

        accRewardsPerShare = accRewardsPerShare.add(
            rewards.mul(1e12).div(total)
        );
        lastRewards = block.timestamp;
    }

    // View function to see pending tokens (token0)
    function pendingRewards(address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        uint256 _accRewardsPerShare = accRewardsPerShare;

        uint256 period = block.timestamp - lastRewards;
        uint256 rewards = period.mul(rewardsPerSec);
        _accRewardsPerShare = _accRewardsPerShare.add(
            rewards.mul(1e12).div(total)
        );

        return
            user.amount.mul(_accRewardsPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Deposit token1 to farm for token0 allocation
    function deposit(uint256 _amount) public {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount == 0, "Already deposited");
        updateFarm();

        uint256 beforeDeposit = IERC20(token1).balanceOf(address(this));
        IERC20(token1).transferFrom(
            address(msg.sender),
            address(this),
            _amount
        );
        uint256 afterDeposit = IERC20(token1).balanceOf(address(this));

        _amount = afterDeposit.sub(beforeDeposit);

        user.amount = _amount;
        user.rewardDebt = _amount.mul(accRewardsPerShare).div(1e12);
        total = total.add(_amount);

        emit Deposit(msg.sender, _amount, block.timestamp);
    }

    // claim rewards in token0 and withdraw token1 from farm
    // return received rewards
    function claim() external returns (uint256) {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount > 0, "Nothing to claim");
        updateFarm();

        uint256 _amount = user.amount;
        uint256 _amountRewards = user
            .amount
            .mul(accRewardsPerShare)
            .div(1e12)
            .sub(user.rewardDebt);

        IERC20(token0).transfer(address(msg.sender), _amountRewards);
        IERC20(token1).transfer(address(msg.sender), _amount);

        user.amount = 0;
        total = total.sub(_amount);

        emit Claim(msg.sender, _amount, _amountRewards, block.timestamp);
        return _amountRewards;
    }
}
