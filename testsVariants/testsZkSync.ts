import { Wallet, Contract, utils, Provider } from "zksync-web3";
import * as hre from "hardhat";
import { ethers } from "ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { expect } from "chai";

const RICH_WALLET_PK =
  "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110";
const OTHER_RICH_WALLET =
  "0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3";
const THIRD_RICH_WALLET =
  "0xd293c684d884d56f8d6abd64fc76757d3664904e309a0645baf8522ab6366d9e";

const provider = Provider.getDefaultProvider();

const owner = new Wallet(RICH_WALLET_PK);
const otherAccount = new Wallet(OTHER_RICH_WALLET, provider);
const thirdAccount = new Wallet(THIRD_RICH_WALLET, provider);

const deployer = new Deployer(hre, new Wallet(RICH_WALLET_PK));

let Farming: Contract, TestTokenReward: Contract, TestToken: Contract;

async function deployContract(
  deployer: Deployer,
  contract: string,
  args: any
): Promise<Contract> {
  try {
    console.log("Deploying contract");
    const artifact = await deployer.loadArtifact(contract);

    return await deployer.deploy(artifact, args);
  } catch (error) {
    console.error("Error deploying contract");
    console.error(error);
    throw new Error("Error deploying contract");
  }
}

const runTestsZkSync = () => {
  describe("Farming", function () {
    before("Deploy tokens contracts", async () => {
      // deploy tokens for rewards and for deposits
      TestTokenReward = await deployContract(deployer, "TestTokenReward", [
        "A",
        "A",
      ]);

      TestToken = await deployContract(deployer, "TestToken", ["B", "B"]);

      await TestTokenReward.deployed();
      await TestToken.deployed();

      // preparation

      const transfer1 = await TestToken.transfer(otherAccount.address, 1000000);
      await transfer1.wait();

      const transfer2 = await TestToken.transfer(thirdAccount.address, 1000000);
      await transfer2.wait();
    });
    beforeEach("Deploy Farming", async () => {
      // deploy farm
      Farming = await deployContract(deployer, "Farming", [
        TestTokenReward.address,
        TestToken.address,
        100,
      ]);

      await Farming.deployed();

      // preparation
      const approve1 = await TestToken.approve(Farming.address, 1000000);
      await approve1.wait();
      const approve2 = await TestToken.connect(
        otherAccount._signerL2()
      ).approve(Farming.address, 1000000);
      await approve2.wait();
      const approve3 = await TestToken.connect(
        thirdAccount._signerL2()
      ).approve(Farming.address, 1000000);
      await approve3.wait();
      const transfer3 = await TestTokenReward.transfer(
        Farming.address,
        1000000
      );
      await transfer3.wait();
    });

    it("deposits", async function () {
      console.log("Farming address: ", Farming.address);
      // consts
      const amountDepost1 = 1000;
      const amountDepost2 = 250;
      const rewardsPerSec = await Farming.rewardsPerSec();

      const total0 = await Farming.total();
      expect(total0.toNumber()).to.be.eq(0);

      // Deposit 1
      // check balances before deposit
      const balance1Before = await TestToken.balanceOf(owner.address);
      const balanceFarming1Before = await TestToken.balanceOf(Farming.address);

      // deposit transaction
      const dep1Tx = await Farming.deposit(amountDepost1);

      const tx1 = await dep1Tx.wait();
      const event1 = tx1.events?.find((event) => event.event === "Deposit");
      const time1 = event1?.args?.date;

      expect(event1?.args?.depositor).to.be.eq(owner.address);
      expect(event1?.args?.deposit).to.be.eq(amountDepost1);
      expect(event1?.args?.date).to.not.eq(0);

      // check and verify balances after deposit
      const balance1After = await TestToken.balanceOf(owner.address);
      const balanceFarming1After = await TestToken.balanceOf(Farming.address);

      expect(balance1After.toNumber()).to.be.eq(
        balance1Before.sub(amountDepost1).toNumber()
      );
      expect(balanceFarming1After.toNumber()).to.be.eq(
        balanceFarming1Before.add(amountDepost1).toNumber()
      );

      // verify state
      const total1 = await Farming.total();
      const user1 = await Farming.userInfo(owner.address);

      expect(total1.toNumber()).to.be.eq(amountDepost1);

      expect(user1.amount.toNumber()).to.be.eq(amountDepost1);
      expect(user1.rewardDebt.toNumber()).to.be.eq(0);

      //Deposit 2
      const balance2Before = await TestToken.balanceOf(otherAccount.address);
      const balanceFarming2Before = await TestToken.balanceOf(Farming.address);

      // deposit transaction
      const dep2Tx = await Farming.connect(otherAccount._signerL2()).deposit(
        amountDepost2
      );

      const tx2 = await dep2Tx.wait();
      const event2 = tx2.events?.find((event) => event.event === "Deposit");

      // verify event
      expect(event2?.args?.depositor).to.be.eq(otherAccount.address);
      expect(event2?.args?.deposit).to.be.eq(amountDepost2);
      expect(event2?.args?.date).to.not.eq(0);

      // check and verify balances after deposit
      const balance2After = await TestToken.balanceOf(otherAccount.address);
      const balanceFarming2After = await TestToken.balanceOf(Farming.address);

      expect(balance2After.toNumber()).to.be.eq(
        balance2Before.sub(amountDepost2).toNumber()
      );
      expect(balanceFarming2After.toNumber()).to.be.eq(
        balanceFarming2Before.add(amountDepost2).toNumber()
      );

      // verify state
      const total2 = await Farming.total();
      const accRewardsPerShare = await Farming.accRewardsPerShare();

      const user2 = await Farming.userInfo(otherAccount.address);
      const rewardsForUser1 = await Farming.pendingRewards(owner.address);

      expect(total2.toNumber()).to.be.eq(amountDepost1 + amountDepost2);
      expect(user2.amount.toNumber()).to.be.eq(amountDepost2);

      const user2Dept = user2.amount.mul(accRewardsPerShare).div(1e12);
      expect(user2.rewardDebt.toNumber()).to.be.eq(user2Dept.toNumber());

      expect(rewardsForUser1.toNumber()).to.not.eq(0);

      // reverts
      await expect(Farming.deposit(1)).to.be.rejectedWith("Already deposited");
      await expect(
        Farming.connect(otherAccount._signerL2()).deposit(1)
      ).to.be.rejectedWith("Already deposited");
    });

    it("claims", async function () {
      console.log("Farming address: ", Farming.address);
      // consts
      const amountDepost1 = 1000;
      const amountDepost2 = 250;

      // Deposit 1
      const deposit1 = await Farming.deposit(amountDepost1);
      await deposit1.wait();
      //Deposit 2
      const deposit2 = await Farming.connect(otherAccount._signerL2()).deposit(
        amountDepost2
      );
      await deposit2.wait();

      // check total before claims
      const total1 = await Farming.total();
      expect(total1.toNumber()).to.be.eq(amountDepost1 + amountDepost2);

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

      // find and verify event
      const tx1 = await claim1Tx.wait(); // 0ms, as tx is already confirmed
      const event = tx1.events?.find((event) => event.event === "Claim");

      expect(event?.args?.recepient).to.be.eq(owner.address);
      expect(event?.args?.deposit).to.be.eq(amountDepost1);
      expect(event?.args?.rewards).to.not.eq(0);
      expect(event?.args?.date).to.not.eq(0);

      // check and verify balances after claim
      const balance1After = await TestToken.balanceOf(owner.address);
      const balanceFarming1After = await TestToken.balanceOf(Farming.address);

      const balanceRewards1After = await TestTokenReward.balanceOf(
        owner.address
      );
      const balanceRewardsFarming1After = await TestTokenReward.balanceOf(
        Farming.address
      );

      expect(balance1After.toNumber()).to.be.eq(
        balance1Before.add(amountDepost1).toNumber()
      );
      expect(balanceFarming1After.toNumber()).to.be.eq(
        balanceFarming1Before.sub(amountDepost1).toNumber()
      );

      expect(balanceRewards1After.toNumber()).to.be.eq(
        balanceRewards1Before.add(event?.args?.rewards).toNumber()
      );
      expect(balanceRewardsFarming1After.toNumber()).to.be.eq(
        balanceRewardsFarming1Before.sub(event?.args?.rewards).toNumber()
      );

      // verify state
      const user1 = await Farming.userInfo(owner.address);
      expect(user1.amount.toNumber()).to.be.eq(0);
      expect(user1.rewardDebt.toNumber()).to.be.eq(0);

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
      const claim2Tx = await Farming.connect(otherAccount._signerL2()).claim();

      // find and verify event
      const tx2 = await claim2Tx.wait();
      const event2 = tx2.events?.find((event) => event.event === "Claim");

      expect(event2?.args?.recepient).to.be.eq(otherAccount.address);
      expect(event2?.args?.deposit).to.be.eq(amountDepost2);
      expect(event2?.args?.rewards).to.not.eq(0);
      expect(event2?.args?.date).to.not.eq(0);

      // check and verify balances after claim
      const balance2After = await TestToken.balanceOf(otherAccount.address);
      const balanceFarming2After = await TestToken.balanceOf(Farming.address);

      const balanceRewards2After = await TestTokenReward.balanceOf(
        otherAccount.address
      );
      const balanceRewardsFarming2After = await TestTokenReward.balanceOf(
        Farming.address
      );

      expect(balance2After.toNumber()).to.be.eq(
        balance2Before.add(amountDepost2).toNumber()
      );
      expect(balanceFarming2After.toNumber()).to.be.eq(
        balanceFarming2Before.sub(amountDepost2).toNumber()
      );

      expect(balanceRewards2After.toNumber()).to.be.eq(
        balanceRewards2Before.add(event2?.args?.rewards).toNumber()
      );
      expect(balanceRewardsFarming2After.toNumber()).to.be.eq(
        balanceRewardsFarming2Before.sub(event2?.args?.rewards).toNumber()
      );

      // verify state
      const user2 = await Farming.userInfo(otherAccount.address);
      expect(user2.amount.toNumber()).to.be.eq(0);
      expect(user2.rewardDebt.toNumber()).to.not.eq(0);

      const total2 = await Farming.total();
      expect(total2).to.be.eq(0);

      //reverts
      await expect(Farming.claim()).to.be.rejectedWith("Nothing to claim");
      await expect(
        Farming.connect(otherAccount._signerL2()).claim()
      ).to.be.rejectedWith("Nothing to claim");
    });

    it("rewards", async function () {
      console.log("Farming address: ", Farming.address);
      // consts
      const amountDepost1 = 1000;
      const amountDepost2 = 350;
      const amountDepost3 = 4250;

      const rewardsPerSec = (await Farming.rewardsPerSec()).toNumber();

      // Deposit 1

      const dep1Tx = await Farming.deposit(amountDepost1);
      const tx1 = await dep1Tx.wait();
      const event = tx1.events?.find((event) => event.event === "Deposit");
      const time1 = event?.args?.date;
      // const time1 = (await provider.getBlock(dep1Tx.blockNumber)).timestamp;
      const total1 = (await Farming.total()).toNumber();

      //Deposit 2
      const dep2Tx = await Farming.connect(otherAccount._signerL2()).deposit(
        amountDepost2
      );
      const tx2 = await dep2Tx.wait();
      const event2 = tx2.events?.find((event) => event.event === "Deposit");
      const time2 = event2?.args?.date;
      // const time2 = (await provider.getBlock(dep2Tx.blockNumber)).timestamp;
      const total2 = (await Farming.total()).toNumber();

      //Deposit 3
      const dep3Tx = await Farming.connect(thirdAccount._signerL2()).deposit(
        amountDepost3
      );
      const tx3 = await dep3Tx.wait();
      const event3 = tx3.events?.find((event) => event.event === "Deposit");
      const time3 = event3?.args?.date;
      // const time3 = (await provider.getBlock(dep3Tx.blockNumber)).timestamp;
      const total3 = (await Farming.total()).toNumber();

      //claim
      const claimTx = await Farming.connect(otherAccount._signerL2()).claim();
      const tx4 = await claimTx.wait();
      const event4 = tx4.events?.find((event) => event.event === "Claim");
      const time4 = event4?.args?.date;
      // const time4 = (await provider.getBlock(claimTx.blockNumber)).timestamp;
      const total4 = (await Farming.total()).toNumber();

      const pendingRewards = (
        await Farming.pendingRewards(owner.address)
      ).toNumber();
      const blockNum = provider.blockNumber;
      const time5 = (await provider.getBlock(blockNum)).timestamp;

      const period1 = time2 - time1;
      const period2 = time3 - time2;
      const period3 = time4 - time3;
      const period4 = time5 - time4;

      const totalRewards1 = rewardsPerSec * period1;
      const totalRewards2 =
        (rewardsPerSec * period2 * ((amountDepost1 / total2) * 100)) / 100;
      const totalRewards3 =
        (rewardsPerSec * period3 * ((amountDepost1 / total3) * 100)) / 100;
      const totalRewards4 =
        (rewardsPerSec * period4 * ((amountDepost1 / total4) * 100)) / 100;
      const totalRewards = Math.floor(
        totalRewards1 + totalRewards2 + totalRewards3 + totalRewards4
      );
      console.log(totalRewards, pendingRewards);
      expect(totalRewards).to.be.eq(pendingRewards);
    });
  });
};

module.exports = runTestsZkSync;
