/* eslint-disable jest/valid-expect */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Farming, TestToken, TestTokenReward } from "../typechain-types";
const { expect } = require("chai");
const { ethers } = require("hardhat");

const address0 = "0x0000000000000000000000000000000000000000";

const runTestsEth = () => {
  describe("Farming", function () {
    async function deployFixture() {
      // Contracts are deployed using the first signer/account by default
      const [owner, otherAccount, thirdAccount] = await ethers.getSigners();

      // deploy tokens for rewards and for deposits
      const TestTokenRewardFactory = await ethers.getContractFactory(
        "TestTokenReward"
      );
      const TestTokenReward: TestTokenReward =
        await TestTokenRewardFactory.deploy("A", "A");

      const TestTokenFactory = await ethers.getContractFactory("TestToken");
      const TestToken: TestToken = await TestTokenFactory.deploy("B", "B");

      await TestTokenReward.deployed();
      await TestToken.deployed();

      // deploy farm
      const FarmingFactory = await ethers.getContractFactory("Farming");
      const Farming: Farming = await FarmingFactory.deploy(
        TestTokenReward.address,
        TestToken.address,
        100
      );

      await Farming.deployed();

      expect(Farming.address).to.be.properAddress;

      return {
        Farming,
        TestTokenReward,
        TestToken,
        owner,
        otherAccount,
        thirdAccount,
      };
    }

    it("deposits", async function () {
      const { Farming, TestTokenReward, TestToken, owner, otherAccount } =
        await loadFixture(deployFixture);

      // consts
      const amountDepost1 = 1000;
      const amountDepost2 = 250;
      const rewardsPerSec = await Farming.rewardsPerSec();

      const total0 = await Farming.total();
      expect(total0).to.be.eq(0);

      // Deposit 1

      // check balances before deposit
      const balance1Before = await TestToken.balanceOf(owner.address);
      const balanceFarming1Before = await TestToken.balanceOf(Farming.address);

      // approve tokens for deposit
      await TestToken.approve(Farming.address, amountDepost1);

      // deposit transaction
      const dep1Tx = await Farming.deposit(amountDepost1);

      const time1 = (await ethers.provider.getBlock(dep1Tx.blockNumber))
        .timestamp;

      // verify event
      await expect(dep1Tx)
        .to.emit(Farming, "Deposit")
        .withArgs(owner.address, amountDepost1, time1);

      // check and verify balances after deposit
      const balance1After = await TestToken.balanceOf(owner.address);
      const balanceFarming1After = await TestToken.balanceOf(Farming.address);

      expect(balance1After).to.be.eq(balance1Before.sub(amountDepost1));
      expect(balanceFarming1After).to.be.eq(
        balanceFarming1Before.add(amountDepost1)
      );

      // verify state
      const total1 = await Farming.total();
      const user1 = await Farming.userInfo(owner.address);

      expect(total1).to.be.eq(amountDepost1);

      expect(user1.amount).to.be.eq(amountDepost1);
      expect(user1.rewardDebt).to.be.eq(0);

      //Deposit 2

      // transfer tokens and check balances
      await TestToken.transfer(otherAccount.address, amountDepost2);

      const balance2Before = await TestToken.balanceOf(otherAccount.address);
      const balanceFarming2Before = await TestToken.balanceOf(Farming.address);

      // approve tokens for deposit
      await TestToken.connect(otherAccount).approve(
        Farming.address,
        amountDepost2
      );

      // deposit transaction
      const dep2Tx = await Farming.connect(otherAccount).deposit(amountDepost2);

      const time2 = (await ethers.provider.getBlock((await dep2Tx).blockNumber))
        .timestamp;

      // verify event
      await expect(dep2Tx)
        .to.emit(Farming, "Deposit")
        .withArgs(otherAccount.address, amountDepost2, time2);

      // check and verify balances after deposit
      const balance2After = await TestToken.balanceOf(otherAccount.address);
      const balanceFarming2After = await TestToken.balanceOf(Farming.address);

      expect(balance2After).to.be.eq(balance2Before.sub(amountDepost2));
      expect(balanceFarming2After).to.be.eq(
        balanceFarming2Before.add(amountDepost2)
      );

      // verify state
      const total2 = await Farming.total();
      const accRewardsPerShare = await Farming.accRewardsPerShare();

      const rewardsForUser1 = await Farming.pendingRewards(owner.address);

      const user2 = await Farming.userInfo(otherAccount.address);

      expect(total2).to.be.eq(amountDepost1 + amountDepost2);
      expect(user2.amount).to.be.eq(amountDepost2);

      const user2Dept = user2.amount.mul(accRewardsPerShare).div(1e12);
      expect(user2.rewardDebt).to.be.eq(user2Dept);

      expect(rewardsForUser1).to.be.eq(rewardsPerSec.mul(time2 - time1));

      //reverts
      await expect(Farming.deposit(1)).to.be.revertedWith("Already deposited");
      await expect(Farming.connect(otherAccount).deposit(1)).to.be.revertedWith(
        "Already deposited"
      );
    });

    it("claims", async function () {
      const { Farming, TestTokenReward, TestToken, owner, otherAccount } =
        await loadFixture(deployFixture);

      // consts
      const amountDepost1 = 1000;
      const amountDepost2 = 250;

      // Deposit 1
      await TestToken.approve(Farming.address, amountDepost1);
      await Farming.deposit(amountDepost1);

      //Deposit 2

      await TestToken.transfer(otherAccount.address, amountDepost2);
      await TestToken.connect(otherAccount).approve(
        Farming.address,
        amountDepost2
      );
      await Farming.connect(otherAccount).deposit(amountDepost2);

      // transfer tokens for rewards
      await TestTokenReward.transfer(Farming.address, 100000);

      // check total before claims
      const total1 = await Farming.total();
      expect(total1).to.be.eq(amountDepost1 + amountDepost2);

      // claim 1

      // check balances before claim
      const balance1Before = await TestToken.balanceOf(owner.address);
      const balanceFarming1Before = await TestToken.balanceOf(Farming.address);

      const balanceRewards1Before = await TestTokenReward.balanceOf(
        owner.address
      );
      const balanceRewardsFarming1Before = await TestTokenReward.balanceOf(
        Farming.address
      );

      // claim transaction
      const claim1Tx = await Farming.claim();

      const time1 = (
        await ethers.provider.getBlock((await claim1Tx).blockNumber)
      ).timestamp;

      // find and verify event
      const rc = await claim1Tx.wait(); // 0ms, as tx is already confirmed
      const event = rc.events?.find((event) => event.event === "Claim");

      expect(event?.args?.recepient).to.be.eq(owner.address);
      expect(event?.args?.deposit).to.be.eq(amountDepost1);
      expect(event?.args?.rewards).to.not.eq(0);
      expect(event?.args?.date).to.be.eq(time1);

      // check and verify balances after claim
      const balance1After = await TestToken.balanceOf(owner.address);
      const balanceFarming1After = await TestToken.balanceOf(Farming.address);

      const balanceRewards1After = await TestTokenReward.balanceOf(
        owner.address
      );
      const balanceRewardsFarming1After = await TestTokenReward.balanceOf(
        Farming.address
      );

      expect(balance1After).to.be.eq(balance1Before.add(amountDepost1));
      expect(balanceFarming1After).to.be.eq(
        balanceFarming1Before.sub(amountDepost1)
      );

      expect(balanceRewards1After).to.be.eq(
        balanceRewards1Before.add(event?.args?.rewards)
      );
      expect(balanceRewardsFarming1After).to.be.eq(
        balanceRewardsFarming1Before.sub(event?.args?.rewards)
      );

      // verify state
      const user1 = await Farming.userInfo(owner.address);
      expect(user1.amount).to.be.eq(0);
      expect(user1.rewardDebt).to.be.eq(0);

      // claim 2

      // check balances before claim
      const balance2Before = await TestToken.balanceOf(otherAccount.address);
      const balanceFarming2Before = await TestToken.balanceOf(Farming.address);

      const balanceRewards2Before = await TestTokenReward.balanceOf(
        otherAccount.address
      );
      const balanceRewardsFarming2Before = await TestTokenReward.balanceOf(
        Farming.address
      );

      // claim transaction
      const claim2Tx = await Farming.connect(otherAccount).claim();

      const time2 = (
        await ethers.provider.getBlock((await claim2Tx).blockNumber)
      ).timestamp;

      // find and verify event
      const rc2 = await claim2Tx.wait();
      const event2 = rc2.events?.find((event) => event.event === "Claim");

      expect(event2?.args?.recepient).to.be.eq(otherAccount.address);
      expect(event2?.args?.deposit).to.be.eq(amountDepost2);
      expect(event2?.args?.rewards).to.not.eq(0);
      expect(event2?.args?.date).to.be.eq(time2);

      // check and verify balances after claim
      const balance2After = await TestToken.balanceOf(otherAccount.address);
      const balanceFarming2After = await TestToken.balanceOf(Farming.address);

      const balanceRewards2After = await TestTokenReward.balanceOf(
        otherAccount.address
      );
      const balanceRewardsFarming2After = await TestTokenReward.balanceOf(
        Farming.address
      );

      expect(balance2After).to.be.eq(balance2Before.add(amountDepost2));
      expect(balanceFarming2After).to.be.eq(
        balanceFarming2Before.sub(amountDepost2)
      );

      expect(balanceRewards2After).to.be.eq(
        balanceRewards2Before.add(event2?.args?.rewards)
      );
      expect(balanceRewardsFarming2After).to.be.eq(
        balanceRewardsFarming2Before.sub(event2?.args?.rewards)
      );

      // verify state
      const user2 = await Farming.userInfo(otherAccount.address);
      expect(user2.amount).to.be.eq(0);
      expect(user2.rewardDebt).to.not.eq(0);

      const total2 = await Farming.total();
      expect(total2).to.be.eq(0);

      //reverts
      await expect(Farming.claim()).to.be.revertedWith("Nothing to claim");
      await expect(Farming.connect(otherAccount).claim()).to.be.revertedWith(
        "Nothing to claim"
      );
    });

    it("rewards", async function () {
      const {
        Farming,
        TestTokenReward,
        TestToken,
        owner,
        otherAccount,
        thirdAccount,
      } = await loadFixture(deployFixture);

      // consts
      const amountDepost1 = 1000;
      const amountDepost2 = 350;
      const amountDepost3 = 4250;

      const period1 = 23;
      const period2 = 12;
      const period3 = 37;
      const period4 = 15;

      const rewardsPerSec = (await Farming.rewardsPerSec()).toNumber();

      // preparation
      await TestToken.approve(Farming.address, amountDepost1);
      await TestToken.transfer(otherAccount.address, amountDepost2);
      await TestToken.connect(otherAccount).approve(
        Farming.address,
        amountDepost2
      );
      await TestToken.transfer(thirdAccount.address, amountDepost3);
      await TestToken.connect(thirdAccount).approve(
        Farming.address,
        amountDepost3
      );
      await TestTokenReward.transfer(Farming.address, 100000);
      // Deposit 1

      const dep1Tx = await Farming.deposit(amountDepost1);
      const time1 = (await ethers.provider.getBlock(dep1Tx.blockNumber))
        .timestamp;
      const total1 = (await Farming.total()).toNumber();

      // "-1" - next block +1 sec
      await time.increase(period1 - 1);

      //Deposit 2
      const dep2Tx = await Farming.connect(otherAccount).deposit(amountDepost2);
      const time2 = (await ethers.provider.getBlock(dep2Tx.blockNumber))
        .timestamp;
      const total2 = (await Farming.total()).toNumber();

      await time.increase(period2 - 1);
      //Deposit 3
      const dep3Tx = await Farming.connect(thirdAccount).deposit(amountDepost3);
      const time3 = (await ethers.provider.getBlock(dep3Tx.blockNumber))
        .timestamp;
      const total3 = (await Farming.total()).toNumber();

      await time.increase(period3 - 1);

      //claim
      const claimTx = await Farming.connect(otherAccount).claim();
      const time4 = (await ethers.provider.getBlock(claimTx.blockNumber))
        .timestamp;
      const total4 = (await Farming.total()).toNumber();

      await time.increase(period4);

      const blockNum = await ethers.provider.getBlockNumber();
      const pendingRewards = (
        await Farming.pendingRewards(owner.address)
      ).toNumber();
      const time5 = (await ethers.provider.getBlock(blockNum)).timestamp;

      expect(period1).to.be.eq(time2 - time1);
      expect(period2).to.be.eq(time3 - time2);
      expect(period3).to.be.eq(time4 - time3);
      expect(period4).to.be.eq(time5 - time4);

      const totalRewards1 = rewardsPerSec * period1; // solo in farm
      const totalRewards2 =
        (rewardsPerSec * period2 * ((amountDepost1 / total2) * 100)) / 100;
      const totalRewards3 =
        (rewardsPerSec * period3 * ((amountDepost1 / total3) * 100)) / 100;
      const totalRewards4 =
        (rewardsPerSec * period4 * ((amountDepost1 / total4) * 100)) / 100;
      const totalRewards = Math.floor(
        totalRewards1 + totalRewards2 + totalRewards3 + totalRewards4
      );
      console.log(totalRewards);
      expect(totalRewards).to.be.eq(pendingRewards);
    });
  });
};

module.exports = runTestsEth;
