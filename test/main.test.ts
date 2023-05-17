import { expect } from "chai";
import { Wallet, Contract, utils, Provider, Signer, Web3Provider} from "zksync-web3";
import * as hre from "hardhat";
import { ethers } from "ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

const RICH_WALLET_PK =
  "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110";
const OTHER_RICH_WALLET =
  "0x3eb15da85647edd9a1159a4a13b9e7c56877c4eb33f614546d4db06a51868b1c";

const provider = Provider.getDefaultProvider();

const owner = new Wallet(RICH_WALLET_PK);
const otherAccount = new Wallet(OTHER_RICH_WALLET,provider);


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

describe("Farming", function () {
  before("Deploy contracts", async () => {
    // deploy tokens for rewards and for deposits
    TestTokenReward = await deployContract(deployer, "TestTokenReward", [
      "A",
      "A",
    ]);

    TestToken = await deployContract(deployer, "TestToken", ["B", "B"]);

    await TestTokenReward.deployed();
    await TestToken.deployed();
    // deploy farm
    Farming = await deployContract(deployer, "Farming", [
      TestTokenReward.address,
      TestToken.address,
      100,
    ]);

    await Farming.deployed();

    return { Farming, TestTokenReward, TestToken };
  });

  it("deposits", async function () {
    // consts
    const amountDepost1 = 1000;
    const amountDepost2 = 250;
    const rewardsPerSec = await Farming.rewardsPerSec();

    const total0 = await Farming.total();
    console.log(total0.toNumber());
    expect(total0.toNumber()).to.be.eq(0);

    // Deposit 1

    // check balances before deposit
    const balance1Before = await TestToken.balanceOf(owner.address);
    const balanceFarming1Before = await TestToken.balanceOf(Farming.address);

    // approve tokens for deposit
    await TestToken.approve(Farming.address, amountDepost1);

    // deposit transaction
    const dep1Tx = await Farming.deposit(amountDepost1);
    console.log(dep1Tx);

    await dep1Tx.wait();
    // const time1 = (await ethers.provider.getBlock(dep1Tx.blockNumber))
    //   .timestamp;

    // verify event
    // await expect(dep1Tx)
    //   .to.emit(Farming, "Deposit")
    //   .withArgs(owner.address, amountDepost1, time1);

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
    // transfer tokens and check balances
    const transfer = await TestToken.transfer(otherAccount.address, amountDepost2);
    await transfer.wait();
    const balance2Before = await TestToken.balanceOf(otherAccount.address);
    const balanceFarming2Before = await TestToken.balanceOf(Farming.address);
    console.log(otherAccount._signerL2())
    // approve tokens for deposit
    await TestToken.connect(otherAccount._signerL2()).approve(
      Farming.address,
      amountDepost2
    );


    // deposit transaction
    const dep2Tx = await Farming.connect(otherAccount._signerL2()).deposit(
      amountDepost2
    );
    await dep2Tx.wait();
    // const time2 = (await ethers.provider.getBlock((await dep2Tx).blockNumber))
    //   .timestamp;

    // verify event
    // await expect(dep2Tx)
    //   .to.emit(Farming, "Deposit")
    //   .withArgs(otherAccount.address, amountDepost2, time2);

    // check and verify balances after deposit
    const balance2After = await TestToken.balanceOf(otherAccount.address);
    const balanceFarming2After = await TestToken.balanceOf(Farming.address);

    expect(balance2After.toNumber()).to.be.eq(
      (balance2Before.sub(amountDepost2)).toNumber()
    );
    expect(balanceFarming2After.toNumber()).to.be.eq(
      (balanceFarming2Before.add(amountDepost2)).toNumber()
    );

    // verify state
    const total2 = await Farming.total();
    const accRewardsPerShare = await Farming.accRewardsPerShare();

    const rewardsForUser1 = await Farming.pendingRewards(owner.address);

    const user2 = await Farming.userInfo(otherAccount.address);

    expect(total2.toNumber()).to.be.eq(amountDepost1 + amountDepost2);
    expect(user2.amount.toNumber()).to.be.eq(amountDepost2);

    const user2Dept = user2.amount.mul(accRewardsPerShare).div(1e12);
    expect(user2.rewardDebt.toNumber()).to.be.eq(user2Dept.toNumber());

    // expect(rewardsForUser1).to.be.eq(rewardsPerSec.mul(time2 - time1));

    //reverts
    // await expect(Farming.deposit(1)).to.be.revertedWith("Already deposited");
    // await expect(Farming.connect(otherAccount).deposit(1)).to.be.revertedWith(
    //   "Already deposited"
    // );
  });
});
